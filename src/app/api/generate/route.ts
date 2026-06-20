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

  // Track which engine will actually be used (may fall back to flux at resolve time)
  let actualEngine = engineType;

  // Detail image type prompts (server-side only)
  // Types that should be clean white-bg + Canvas text overlay (no AI text generation)
  const INFO_TYPES = new Set(["selling_points", "material", "size", "craft", "compare"]);

  const DETAIL_PROMPTS: Record<string, string> = {
    // TikTok Shop 9-step + Shopify PDP framework: Scene→Selling→Size→Detail→Usage→Compare→Packaging

    // ── 信息类型：白底图 + Canvas文字 ──
    selling_points: "Product centered on pure white background, soft studio lighting, no text, no labels, no watermarks, clean e-commerce product photography, 4K",
    material: "Extreme macro close-up of the product on white background, texture clearly visible, no text, no labels, clean product detail photography, 4K",
    size: "Product on pure white background with a common object (coin or ruler) for scale comparison, clean studio lighting, no text overlay, no labels, 4K",
    craft: "Product on a clean white surface, hands-free still life style, no text, no people, clean studio photography, 4K",
    compare: "Split screen layout showing two views of the same product side by side on white background, clean comparison, no text overlay, no labels, 4K",

    // ── 场景与使用 ──
    lifestyle: "Natural lifestyle scene showing the product in its intended environment. For electronics/earbuds: a person wearing them in a city street or gym. For furniture: styled in a bright modern room. For beauty: on a bathroom vanity in morning light. Soft natural lighting, candid photography, relatable and authentic, editorial quality, 4K",
    scene_atmosphere: "Atmospheric product photography with the product as the hero. Dramatic yet natural lighting. For electronics: product glowing on a dark desk. For home fragrance: candle flickering in a dim cozy room. For fashion: garment blowing in wind. Emotional depth, premium commercial photography, 4K",

    // ── 使用展示 ──
    in_use: "The product being actively used or worn. For earbuds/headphones: worn by a model, showing how they fit and look. For smartwatches/wearables: on a wrist, showing the display. For kitchen tools: hands actively cooking. For beauty tools: applying on skin. Natural interaction, candid moment, soft daylight, authentic lifestyle, 4K",

    // ── 多角度 ──
    multi_angle: "Professional product photography showing multiple angles in one composited image: front, back, side, top-down, and 45-degree angle. Consistent lighting, white background, e-commerce multi-angle set, 4K",

    // ── 细节 ──
    detail: "Extreme macro close-up emphasizing premium craftsmanship. For earbuds: ear tip texture, charging contacts. For watches: dial detail, clasp mechanism. For bags/luggage: zipper quality, leather grain. For kitchenware: blade edge, non-stick surface. Shallow depth of field, professional product photography, 4K",

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
      prompt = `${prompt}. Use this lighting and color style as a loose guide: ${baseStyle}.${seedSuffix} Vary the camera angle, product distance, and composition between frames. Same product, same mood, different perspective each time.`;
    }
    // Text overlay is handled client-side via Canvas — not requested in prompt
  } else if (customPrompt) {
    prompt = customPrompt;
  } else if (promptTemplateId) {
    const template = await db.promptTemplate.findUnique({
      where: { id: promptTemplateId },
    });
    if (template) prompt = template.prompt;
  }

  // Keep product faithful to reference image (applies to ALL modes, not just detailType)
  if (referenceImageUrl) {
    prompt = `${prompt}. CRITICAL: Keep the product and any person visually IDENTICAL to the reference image — same shape, same color, same materials, same details. Only change the background, scene, pose, framing, or camera angle. Do NOT substitute the product with a different one.`;
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
  if (actualEngine === "sdxl" || actualEngine === "playground") {
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
  const modelVersion = ENGINE_MODELS[actualEngine] || ENGINE_MODELS.flux;

  // Resolve provider — fallback to flux for Gemini-based engines when unavailable
  let provider;
  try {
    provider = getProvider(engineType);
  } catch {
    if (engineType === "gemini" || engineType === "banana" || engineType === "gpt-image") {
      try {
        provider = getProvider("flux");
        actualEngine = "flux";
        console.warn(`Engine "${engineType}" not available, falling back to flux`);
      } catch {
        return NextResponse.json(
          { error: "No AI engine available" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: `AI engine "${engineType}" is not available` },
        { status: 400 }
      );
    }
  }

  // Create task — record actual engine used (may differ from requested on fallback)
  const task = await db.task.create({
    data: {
      imageProjectId,
      productImageId,
      promptTemplateId: promptTemplateId ?? null,
      engineType: actualEngine,
      status: "PENDING",
    },
  });

  // Update project title + status
  await db.imageProject.update({
    where: { id: imageProjectId },
    data: { status: "GENERATING", title: projectTitle || undefined },
  });

  // Synchronous image providers (Nano Banana 2, GPT Image 2 via laozhang.ai)
  // Only take this path if the provider actually resolved to a Gemini-based one (not fallen back to Flux)
  if ((engineType === "gemini" || engineType === "banana" || engineType === "gpt-image") && actualEngine !== "flux") {
    try {
      const result = await provider.createPrediction({
        prompt,
        productImageUrl: sharedImageUrl,
        referenceImageUrl: referenceImageUrl ?? undefined,
        numOutputs: 1,
        width: genWidth,
        height: genHeight,
      });

      if ((result as any).outputs?.[0]?.url) {
        const imgUrl = (result as any).outputs[0].url;
        // Upload to R2 so the image doesn't expire
        let finalUrl = imgUrl;
        let finalKey = imgUrl;
        if (hasS3Config()) {
          try {
            const imageBuf = await fetchImageBuffer(imgUrl);
            const r2 = await uploadBuffer(imageBuf, "image/png", "generated/");
            finalUrl = r2.publicUrl;
            finalKey = r2.s3Key;
          } catch { /* keep provider URL as fallback */ }
        }
        const saved = await db.generatedImage.create({
          data: {
            imageProjectId, productImageId,
            s3Key: finalKey, url: finalUrl, promptUsed: prompt,
            aiProvider: actualEngine, status: "SUCCEEDED", completedAt: new Date(),
          },
        });
        await db.task.update({ where: { id: task.id }, data: { status: "SUCCEEDED", resultUrl: finalUrl } });
        await db.imageProject.update({ where: { id: imageProjectId }, data: { status: "GENERATED" } });
        return NextResponse.json({ taskId: task.id, status: "succeeded", generatedImageId: saved.id, url: finalUrl });
      }
    } catch {
      // Fallback to Flux
    }
    // Gemini failed — fall back to Flux
    const fluxProvider = getProvider("flux");
    provider = fluxProvider;
  }

  if (actualEngine === "openai") {
    // ── OpenAI synchronous path ──
    try {
      const result = await provider.createPrediction({
        prompt,
        productImageUrl: sharedImageUrl,
        numOutputs,
      });

      const openaiUrl = (result as { openaiUrl?: string }).openaiUrl;
      const imageUrl = openaiUrl ?? "";

      // Upload to R2 so the image doesn't expire
      let finalUrl = imageUrl;
      let finalKey = imageUrl;
      let fileSize = 0;
      let mimeType = "image/png";
      if (hasS3Config() && imageUrl) {
        try {
          const imageBuf = await fetchImageBuffer(imageUrl);
          fileSize = imageBuf.length;
          const r2 = await uploadBuffer(imageBuf, "image/png", "generated/");
          finalUrl = r2.publicUrl;
          finalKey = r2.s3Key;
        } catch { /* keep provider URL as fallback */ }
      }

      const generatedImage = await db.generatedImage.create({
        data: {
          imageProjectId,
          productImageId,
          s3Key: finalKey,
          url: finalUrl,
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
          aiProvider: actualEngine, status: "PROCESSING",
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
        // Always re-upload to R2 so images don't expire
        if (hasS3Config()) {
          try {
            const imageBuf = await fetchImageBuffer(output.url);
            const { publicUrl: newUrl, s3Key: newKey } = await uploadBuffer(imageBuf, output.mimeType ?? "image/png", "generated/");
            finalUrl = newUrl;
            await db.generatedImage.update({ where: { id: placeholder.id }, data: { url: newUrl, s3Key: newKey } });
          } catch { /* keep original */ }
        }
        // Apply brand logo overlay if present (non-FREE users)
        const presetLogo = brandPreset?.logoUrl;
        if (presetLogo && quota.tier !== "FREE") {
          try {
            const imageBuf = await fetchImageBuffer(finalUrl);
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
