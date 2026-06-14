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
    seed,
  } = await req.json();

  // Detail image type prompts (server-side only)
  const DETAIL_PROMPTS: Record<string, string> = {
    // TikTok Shop 9-step + Shopify PDP framework: Scene→Selling→Size→Detail→Usage→Compare→Packaging

    // ── 场景与使用 ──
    lifestyle: "Natural lifestyle scene showing the product in its intended environment. For electronics/earbuds: a person wearing them in a city street or gym. For furniture: styled in a bright modern room. For beauty: on a bathroom vanity in morning light. Soft natural lighting, candid photography, relatable and authentic, editorial quality, 4K",
    scene_atmosphere: "Atmospheric product photography with the product as the hero. Dramatic yet natural lighting. For electronics: product glowing on a dark desk. For home fragrance: candle flickering in a dim cozy room. For fashion: garment blowing in wind. Emotional depth, premium commercial photography, 4K",

    // ── 使用展示 ──
    in_use: "The product being actively used or worn. For earbuds/headphones: worn by a model, showing how they fit and look. For smartwatches/wearables: on a wrist, showing the display. For kitchen tools: hands actively cooking. For beauty tools: applying on skin. Natural interaction, candid moment, soft daylight, authentic lifestyle, 4K",

    // ── 卖点与功能 ──
    selling_points: "Product key selling points infographic, ONE FEATURE per image with clean callout text and icon. For electronics: highlight battery life, noise cancellation, waterproof rating. For appliances: energy efficiency, capacity, smart features. For furniture: material quality, weight capacity, assembly ease. White background, professional layout, 8K",
    compare: "Before and after comparison, split screen layout. For beauty/skincare: visible improvement. For cleaning products: dirty vs clean surface. For electronics: old device vs new device. For furniture: empty room vs styled room. Clean composition, professional presentation, convincing visual evidence",

    // ── 尺寸与多角度 ──
    size: "Product size comparison with measurement reference. Product held in a real hand or next to a common object (phone, coin, banana for scale). For furniture: a person sitting/standing next to it showing proportions. For appliances: on a kitchen counter with other items. Clean studio lighting, dimensional guide, white background, 4K",
    multi_angle: "Professional product photography showing multiple angles in one composited image: front, back, side, top-down, and 45-degree angle. For wearables: also show it being worn from different angles. Consistent lighting, white background, e-commerce multi-angle set, 4K",

    // ── 材质与细节 ──
    material: "Product detail shot focused on material quality and texture. For electronics: brushed metal surface, precision buttons, cable quality. For furniture: wood grain, fabric weave, stitching detail. For appliances: control panel, handle finish, interior compartment. Macro lens, soft studio lighting, white background, 4K",
    detail: "Extreme macro close-up emphasizing premium craftsmanship. For earbuds: ear tip texture, charging contacts. For watches: dial detail, clasp mechanism. For bags/luggage: zipper quality, leather grain. For kitchenware: blade edge, non-stick surface. Shallow depth of field, professional product photography, 4K",

    // ── 使用说明 ──
    craft: "Step-by-step usage guide or assembly instruction in a clean visual layout. Numbered steps with icons showing how to set up, operate, or maintain the product. For electronics: pairing and charging guide. For furniture: assembly overview. For appliances: control panel walkthrough. Clean white background, instructional diagram style, 4K",

    // ── 颜色与搭配 ──
    color_variants: "Grid layout photography showing the product in all available color or finish options. Consistent lighting and angle across all variants. For electronics: silver/black/blue variants. For fashion: all color options. For furniture: all wood/stain choices. Organized arrangement, white background, 4K",
    flatlay: "Overhead flat lay photography of the product surrounded by carefully curated complementary accessories and lifestyle props. For electronics: cables, case, charger, desk items. For beauty: brushes, other products, flowers. For food: ingredients, utensils, linens. Clean surface, soft even lighting, editorial catalog style, 4K",

    // ── 包装与信任 ──
    brand_story: "Brand storytelling image showing the product packaging alongside its contents. Premium unboxing experience. For electronics: box, inserts, device, cable, manual all neatly arranged. For luxury goods: gift box, ribbon, dust bag. Warm emotional lighting, trust-building visual, 4K",
    gift_accessory: "Product photography showing the main product with all included accessories, cables, adapters, or complementary items that come in the box. Everything clearly visible and labeled. For electronics: device + charger + cable + case + manual. Clean composition, soft studio lighting, white background, 4K",
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
    if (baseStyle) {
      // Match the main image's lighting, color palette, and overall aesthetic — lock across the entire set
      const seedSuffix = seed ? `_{seed=${seed}}` : "";
      prompt = `${prompt}. All images in this set MUST share identical lighting quality, color temperature, and visual style: ${baseStyle}.${seedSuffix} Keep the aesthetic perfectly consistent across every frame like a professional photoshoot set.`;
    }
    if (customDesc) prompt = `${prompt}. Additionally, overlay the following text clearly on the image: "${customDesc}". The text should be clean, readable, and professionally placed on the image.`;
    // Keep product and person faithful to reference image
    if (referenceImageUrl) {
      prompt = `${prompt}. Keep the product and any person visually identical to the reference image—same face, same build, same product appearance. Only change the pose, framing, or background context.`;
    }
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

  // SDXL / fast models: simplify prompt to keyword format for better results
  if (engineType === "sdxl" || engineType === "playground") {
    prompt = prompt.replace(/[.,;!?]/g, " ").replace(/\s+/g, " ").split(" ").slice(0, 77).join(" ").trim();
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
