import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { checkGenerationQuota } from "@/lib/lemonsqueezy/billing";
import { PLATFORM_SPECS } from "@/lib/platform-specs";
import { serverT } from "@/lib/server-t";
import { getSignedGetUrl } from "@/lib/s3";
import { overlayLogo, fetchImageBuffer } from "@/lib/overlay-logo";
import { uploadBuffer, hasS3Config } from "@/lib/s3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const {
    imageProjectId,
    productImageId,
    promptTemplateId,
    brandPresetId,
    prompt: customPrompt,
    numOutputs: customNumOutputs,
    engineType = "flux",
    targetPlatform,
  } = await req.json();

  if (!imageProjectId || !productImageId) {
    return NextResponse.json(
      { error: "imageProjectId and productImageId are required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const project = await db.imageProject.findUnique({
    where: { id: imageProjectId },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Quota check
  const quota = await checkGenerationQuota(userId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        message: `${await serverT("error.quotaExceeded")} (${quota.used}/${quota.limit})`,
        tier: quota.tier,
      },
      { status: 402 }
    );
  }

  // Double-click guard
  const existing = await db.task.findFirst({
    where: {
      imageProjectId,
      productImageId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "already_generating", taskId: existing.id },
      { status: 409 }
    );
  }

  // Get product image
  const productImage = await db.productImage.findUnique({
    where: { id: productImageId },
  });
  if (!productImage) {
    return NextResponse.json(
      { error: "Product image not found" },
      { status: 404 }
    );
  }

  // Generate a public presigned URL so Replicate/DeepSeek can access the image
  const isR2Image = productImage.s3Key && (productImage.s3Key.startsWith("products/") || productImage.s3Key.startsWith("generated/"));
  const sharedImageUrl = isR2Image
    ? await getSignedGetUrl(productImage.s3Key, 3600).catch(() => productImage.originalUrl)
    : productImage.originalUrl;

  // Prompt resolution
  let prompt = "Professional product photography, studio lighting, high quality";
  if (customPrompt) {
    prompt = customPrompt;
  } else if (promptTemplateId) {
    const template = await db.promptTemplate.findUnique({
      where: { id: promptTemplateId },
    });
    if (template) prompt = template.prompt;
  }

  // Brand preset injection
  let brandPreset = null;
  if (brandPresetId) {
    brandPreset = await db.brandPreset.findUnique({
      where: { id: brandPresetId, userId },
    });
    if (brandPreset) {
      const colors = (brandPreset.colors as string[]) ?? [];
      const colorHint = colors.length > 0
        ? `, brand colors: ${colors.slice(0, 3).join(", ")}`
        : "";
      prompt = `${prompt}, brand identity: "${brandPreset.name}"${colorHint}, consistent with brand visual style, professional product photography`;
    }
  }

  // Platform-specific prompt injection
  if (targetPlatform && PLATFORM_SPECS[targetPlatform]) {
    prompt = `${prompt}, ${PLATFORM_SPECS[targetPlatform].promptSuffix}`;
  }

  const numOutputs = customNumOutputs ?? 2;

  // Model version mapping for alternative engines (all routed through Replicate)
  const ENGINE_MODELS: Record<string, string> = {
    flux: "black-forest-labs/flux-2-pro",
    flux2: "black-forest-labs/flux-2-pro",
    sdxl: "stability-ai/sdxl",
    playground: "playgroundai/playground-v2.5-1024px-aesthetic",
  };
  const modelVersion = ENGINE_MODELS[engineType] || ENGINE_MODELS.flux;

  // Resolve provider
  let provider;
  try {
    provider = getProvider(engineType);
  } catch {
    return NextResponse.json(
      { error: `AI engine "${engineType}" is not available` },
      { status: 400 }
    );
  }

  // Create task
  const task = await db.task.create({
    data: {
      imageProjectId,
      productImageId,
      promptTemplateId: promptTemplateId ?? null,
      engineType,
      status: "PENDING",
    },
  });

  // Update project to GENERATING
  await db.imageProject.update({
    where: { id: imageProjectId },
    data: { status: "GENERATING" },
  });

  if (engineType === "openai") {
    // ── OpenAI synchronous path ──
    try {
      const result = await provider.createPrediction({
        prompt,
        productImageUrl: sharedImageUrl,
        numOutputs,
      });

      const openaiUrl = (result as { openaiUrl?: string }).openaiUrl;
      const imageUrl = openaiUrl ?? "";

      // Fetch the image to get file metadata
      let fileSize = 0;
      let mimeType = "image/png";
      try {
        const headRes = await fetch(imageUrl, { method: "HEAD" });
        fileSize = Number(headRes.headers.get("content-length") ?? 0);
        mimeType = headRes.headers.get("content-type") ?? "image/png";
      } catch {
        // Metadata fetch is best-effort
      }

      const generatedImage = await db.generatedImage.create({
        data: {
          imageProjectId,
          productImageId,
          s3Key: imageUrl,
          url: imageUrl,
          promptUsed: prompt,
          aiProvider: "openai",
          modelVersion: "gpt-image-2",
          fileSize,
          mimeType,
          width: 1024,
          height: 1024,
          status: "SUCCEEDED",
          completedAt: new Date(),
        },
      });

      await db.task.update({
        where: { id: task.id },
        data: { predictionId: result.predictionId, status: "SUCCEEDED", resultUrl: imageUrl },
      });

      // Check if all tasks for this project are done
      const pendingCount = await db.task.count({
        where: { imageProjectId, status: { in: ["PENDING", "PROCESSING"] } },
      });
      if (pendingCount === 0) {
        await db.imageProject.update({
          where: { id: imageProjectId },
          data: { status: "GENERATED" },
        });
      }

      return NextResponse.json({
        taskId: task.id,
        status: "succeeded",
        generatedImageId: generatedImage.id,
        url: imageUrl,
      });
    } catch (error) {
      await db.task.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
      await db.imageProject.update({
        where: { id: imageProjectId },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "generation_failed", message: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  // ── Flux (Replicate) path ──
  try {
    const prediction = await provider.createPrediction({
      prompt,
      productImageUrl: sharedImageUrl,
      numOutputs,
      modelVersion,
    });

    await db.task.update({
      where: { id: task.id },
      data: { predictionId: prediction.predictionId, status: "PROCESSING" },
    });

    const placeholder = await db.generatedImage.create({
      data: {
        imageProjectId, productImageId,
        s3Key: "pending", url: "", promptUsed: prompt,
        aiProvider: engineType, status: "PROCESSING",
        webhookId: prediction.predictionId,
      },
    });

    // Poll until complete
    let attempts = 0;
    let imageResult = await provider.getPrediction(prediction.predictionId);
    while (imageResult.status === "processing" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      imageResult = await provider.getPrediction(prediction.predictionId);
      attempts++;
    }

    if (imageResult.status === "succeeded" && imageResult.outputs.length > 0) {
      const output = imageResult.outputs[0];
      await db.generatedImage.update({
        where: { id: placeholder.id },
        data: {
          url: output.url, s3Key: output.url,
          fileSize: output.fileSize ?? 0, mimeType: output.mimeType ?? "image/png",
          width: output.width ?? 1024, height: output.height ?? 1024,
          status: "SUCCEEDED", completedAt: new Date(),
        },
      });

      // Brand logo overlay (PRO+ only)
      let finalUrl = output.url;
      const presetLogo = brandPreset?.logoUrl;
      if (presetLogo && quota.tier !== "FREE") {
        try {
          const imageBuf = await fetchImageBuffer(output.url);
          const logoUrl: string = (presetLogo.startsWith("products/") || presetLogo.startsWith("generated/"))
            ? await getSignedGetUrl(presetLogo).catch(() => presetLogo)
            : presetLogo;
          const logoBuf = await fetchImageBuffer(logoUrl);
          const overlaid = await overlayLogo(imageBuf, logoBuf);
          if (hasS3Config()) {
            const { s3Key: newKey, publicUrl: newUrl } = await uploadBuffer(overlaid, "image/png", "generated/");
            await db.generatedImage.update({ where: { id: placeholder.id }, data: { url: newUrl, s3Key: newKey } });
            finalUrl = newUrl;
          }
        } catch { /* keep original */ }
      }

      await db.task.update({ where: { id: task.id }, data: { status: "SUCCEEDED", resultUrl: finalUrl } });

      const pendingCount = await db.task.count({ where: { imageProjectId, status: { in: ["PENDING", "PROCESSING"] } } });
      if (pendingCount === 0) {
        await db.imageProject.update({ where: { id: imageProjectId }, data: { status: "GENERATED" } });
      }

      return NextResponse.json({
        taskId: task.id, status: "succeeded",
        generatedImageId: placeholder.id, url: finalUrl,
      });
    }

    await db.generatedImage.update({
      where: { id: placeholder.id },
      data: { status: "FAILED", errorMessage: imageResult.error ?? "Failed" },
    });
    return NextResponse.json(
      { error: "generation_failed", message: imageResult.error ?? "Timed out" },
      { status: 500 }
    );
  } catch (error) {
    await db.task.update({
      where: { id: task.id },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Unknown error" },
    });
    return NextResponse.json(
      { error: "generation_failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
