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
    title: projectTitle,
    detailType,
    baseStyle,
    customDesc,
    referenceImageUrl,
  } = await req.json();

  // Detail image type prompts (server-side only)
  const DETAIL_PROMPTS: Record<string, string> = {
    // TikTok Shop 9-step Detail Page framework: Scene→Selling→Size→Material→Usage→Compare→Packaging
    // 1. 场景图：产品在生活场景中
    lifestyle: "Natural lifestyle scene showing the product in real use context. For skincare/beauty: a person holding or applying the product in a bright bathroom or vanity setting, showing satisfaction. For fashion: worn by a model in an urban setting. Soft natural lighting, candid photography, relatable and authentic, editorial quality, 4K",
    scene_atmosphere: "Atmospheric product photography with the product as the hero, dramatic cinematic lighting with warm ambiance, emotional depth, premium commercial photography, 4K. For skincare: the product centered on a marble vanity, soft morning light, elegant composition",
    // 2. 核心卖点：每张图一个卖点
    selling_points: "Product key selling points infographic, ONE FEATURE per image. Highlighted features with clean callout text, white background, professional e-commerce layout, 8K, sharp detail. For skincare: highlight one ingredient benefit per image (e.g., Hyaluronic Acid = Deep Hydration)",
    // 3. 尺寸规格：比例对比
    size: "Product size comparison with measurement reference and scale objects (coin, ruler, hand for scale), dimensional guide overlay, clean studio lighting, informative layout, white background, e-commerce sizing reference. Show product in real hand or next to common object for intuitive scale",
    // 4. 材质/成分：微观细节
    material: "Product detail shot focused on material texture and ingredients. For skincare/beauty: show the cream/lotion texture on a fingertip or glass spatula—highlight consistency (whipped, glossy, creamy, gel). For clothing: show fabric weave, stitching detail. Macro lens, soft studio lighting, informative product page layout, white background, 4K",
    detail: "Extreme macro close-up product detail shot, texture and material clearly visible. Show what makes the product feel premium—fine grain, smooth surface, precise edges. Premium product photography, shallow depth of field, soft studio lighting, 4K",
    // 5. 使用步骤/指南
    craft: "Step-by-step product usage guide in a clean composition. Show hands demonstrating how to use the product correctly. For skincare: applying cream on face/hand with arrows or numbered steps. Warm natural lighting, workshop/vanity environment, authentic instructional style, editorial quality",
    // 6. 效果对比
    compare: "Before and after comparison, split screen layout. For skincare: left side shows before, right side shows after application. For other products: old vs new, competitor vs ours. Clean composition, professional presentation, convincing visual evidence",
    // 7. 多角度展示
    multi_angle: "Professional product photography showing the product at multiple angles composited into one image: front view, back view, side view, top-down, 45-degree angle. Consistent lighting across angles, white background, e-commerce multi-angle set, 4K",
    // 8. 颜色/款式变体
    color_variants: "Grid layout photography showing the product in all available color or style variants, consistent lighting and angle across all variants, organized arrangement, white background, e-commerce color selection showcase. For beauty: show different shades or formulations side by side",
    flatlay: "Overhead flat lay photography of the product surrounded by carefully arranged complementary items (ingredients, tools, lifestyle props), clean white surface, soft even lighting, organized composition with intentional negative space, editorial catalog style",
    // 9. 包装/配件/信任
    brand_story: "Brand storytelling image featuring the product packaging alongside key ingredients or brand elements, warm emotional lighting, trust-building visual, editorial brand campaign photography, premium aesthetic. Show packaging quality—box material, seal, included accessories",
    gift_accessory: "Product photography showing the main product alongside complementary accessories or gift items included in the purchase, clean composition, soft studio lighting, all items in sharp focus, professional e-commerce bundle presentation, white background, 4K",
  };

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
  if (detailType && DETAIL_PROMPTS[detailType]) {
    prompt = DETAIL_PROMPTS[detailType];
    if (baseStyle) prompt = `${prompt}, consistent with this style: ${baseStyle}`;
    if (customDesc) prompt = `${prompt}. Additional instructions: ${customDesc}`;
    // Keep person consistent — reference the main generated image URL
    if (referenceImageUrl) prompt = `${prompt}. Keep the same person/product as in the reference image, only change the scene, pose, or context.`;
  } else if (customPrompt) {
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

  // Platform-specific prompt injection and dimensions
  let genWidth = 1024;
  let genHeight = 1024;
  if (targetPlatform && PLATFORM_SPECS[targetPlatform]) {
    const spec = PLATFORM_SPECS[targetPlatform];
    prompt = `${prompt}, ${spec.promptSuffix}`;
    genWidth = spec.width;
    genHeight = spec.height;
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

  // Update project title + status
  await db.imageProject.update({
    where: { id: imageProjectId },
    data: { status: "GENERATING", title: projectTitle || undefined },
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

  // ── Flux (Replicate) path: loop for multi-output (single-prediction limit is 1) ──
  try {
    const generatedIds: string[] = [];

    for (let i = 0; i < numOutputs; i++) {
      const prediction = await provider.createPrediction({
        prompt: `${prompt} ${i > 0 ? `(variant ${i + 1})` : ""}`,
        productImageUrl: sharedImageUrl,
        referenceImageUrl,
        numOutputs: 1,
        width: genWidth,
        height: genHeight,
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
      let imageResult = await provider.getPrediction(prediction.predictionId);
      let polls = 0;
      while (imageResult.status === "processing" && polls < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        imageResult = await provider.getPrediction(prediction.predictionId);
        polls++;
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

        let finalUrl = output.url;
        const presetLogo = brandPreset?.logoUrl;
        if (presetLogo && quota.tier !== "FREE") {
          try {
            const imageBuf = await fetchImageBuffer(output.url);
            const logoUrl = await getSignedGetUrl(presetLogo).catch(() => presetLogo);
            const logoBuf = await fetchImageBuffer(logoUrl);
            const overlaid = await overlayLogo(imageBuf, logoBuf);
            if (hasS3Config()) {
              const { publicUrl: newUrl } = await uploadBuffer(overlaid, "image/png", "generated/");
              await db.generatedImage.update({ where: { id: placeholder.id }, data: { url: newUrl, s3Key: newUrl } });
              finalUrl = newUrl;
            }
          } catch { /* keep original */ }
        }
        generatedIds.push(placeholder.id);
      } else {
        generatedIds.push("");
      }
    }

    const succeeded = generatedIds.filter(Boolean);
    if (succeeded.length > 0) {
      const firstId = succeeded[0];
      const firstImg = await db.generatedImage.findUnique({ where: { id: firstId } });

      await db.task.update({ where: { id: task.id }, data: { status: "SUCCEEDED", resultUrl: firstImg?.url ?? "" } });
      await db.imageProject.update({ where: { id: imageProjectId }, data: { status: "GENERATED" } });

      return NextResponse.json({
        taskId: task.id, status: "succeeded",
        generatedImageId: firstId, url: firstImg?.url ?? "",
        count: succeeded.length,
      });
    }

    // All generations failed
    await db.task.update({ where: { id: task.id }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "generation_failed", message: "All attempts failed" },
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
