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
    detailTypes, // batch detail types: [{ key, prompt }]
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
    // TikTok Shop 9-step + Shopify PDP framework
    // Information types: clean white-bg, Canvas text overlay applied client-side

    // ── 信息类型：白底图 + Canvas文字（AI 出干净底图，前端合文字）───
    selling_points: "Product centered on pure white background #FFFFFF, product filling 85% of frame, soft diffused studio lighting 5500K dual softboxes 45 degrees, no harsh shadows, subtle ground contact shadow only, no text, no labels, no watermarks, no icons, abundant negative space around product for text overlay, clean minimal e-commerce packshot, 8K, 2048x2048px square, color-accurate sRGB",
    material: "Extreme macro close-up product photography on pure white background, 100mm macro lens f/2.8, texture and material grain crisply visible — leather pores, fabric weave, wood grain, metal brushing, glass clarity. Shallow depth of field, focal point on the most impressive texture area. Soft diffused ring light, no harsh specular highlights. No text, no labels. Premium product detail photography, 8K",
    size: "Product on pure white background with a universally recognized scale object — standard soda can, US quarter coin, or metric ruler — placed beside it for instant size comprehension. Both product and scale object in same focal plane, equally sharp at f/8. Clean studio lighting 5500K. No text overlay, no labels. Professional e-commerce size reference photography, 4K",
    craft: "Product on a clean white surface, hands-free still-life composition showing fine craftsmanship details — seam alignment, edge finishing, hardware attachment, material joining. Soft directional light raking across surface at 30 degrees to reveal subtle surface depth and texture. No people in frame. No text, no labels. Clean professional product photography, 4K",
    compare: "Split-screen product comparison photography. Two views or variants of the same product side by side on pure white background. Identical lighting, identical scale, identical camera angle. Clean vertical dividing line centered. Left and right equally sharp at f/11. No text overlay, no labels. Professional e-commerce comparison layout, 8K",

    // ── 场景与氛围 ──
    lifestyle: "Authentic lifestyle product photography. Product naturally integrated into its intended real-world environment. For electronics: person using it on a clean desk, coffee nearby. For furniture: styled in a bright modern living room with window light. For beauty: on a bathroom vanity in soft morning light. For kitchenware: hands actively cooking in a warm kitchen. Candid editorial quality, soft natural daylight 5600K from left window. 50mm lens at f/2.2, product in sharp focus, background softly blurred. Relatable and aspirational. 4K, Kinfolk/Cereal magazine aesthetic",
    scene_atmosphere: "Atmospheric emotional product photography with the product as the lone hero. Dramatic directional lighting. For electronics: product glowing alone on a dark wooden desk with dust motes dancing in a single light beam. For candles/fragrance: single candle flickering in a dim cozy room with soft warm bokeh circles. For fashion: garment draped and blowing gently in wind against a misty morning backdrop. Deep emotional resonance. 85mm lens at f/1.8, ultra-shallow depth of field, product pin-sharp. 4K, cinematic, premium commercial photography",

    // ── 使用展示 ──
    in_use: "Authentic in-use product photography. The product being actively used or worn by a person — candid mid-action moment, not looking at camera. For wearables/earbuds: worn by model showing comfortable fit and scale on ear. For smartwatches/wearables: on wrist with display visible. For kitchen tools: hands actively chopping or stirring. For beauty tools: applying on skin. Natural interaction, soft daylight 5500K, 50mm lens at f/2.0, focus on product. 4K, editorial lifestyle quality, warm and relatable",

    // ── 多角度 ──
    multi_angle: "Professional multi-angle product photography composited into one clean layout. Five views: front, 45-degree front, side profile, rear, and top-down. All on pure white background #FFFFFF. Consistent lighting 5500K, identical scale across all views. Clean grid arrangement with equal spacing. No text overlay aside from optional 10px grey angle labels. 8K, commercial product catalog quality",

    // ── 细节 ──
    detail: "Extreme macro close-up emphasizing premium craftsmanship. 100mm macro lens at f/3.2, very shallow depth of field isolating one exquisite detail. For earbuds: ear tip silicone texture and charging contact precision. For watches: dial guilloche pattern and clasp mechanism. For bags/luggage: leather grain and zipper teeth quality. For kitchenware: blade edge sharpness and non-stick coating. Soft diffused light reveals fine detail without harsh reflections. 8K, premium inspection-grade quality",

    // ── 颜色与搭配 ──
    color_variants: "Product photography showing all available color or finish variants in one clean grid layout. Organized arrangement on pure white background. Consistent lighting and camera angle across every variant. Equal spacing and identical scale. For electronics: silver/black/blue/gold variants. For fashion: all seasonal colorways. For furniture: all wood or stain finish options. Professional catalog presentation, 8K, no text overlay",
    flatlay: "Overhead flat lay product photography shot from directly above. Product as the centerpiece, surrounded by carefully curated complementary accessories and lifestyle props. For electronics: braided USB cable, protective case, charging brick, desk mat, notebook. For beauty: brushes, other products, dried flowers, linen cloth. For food: fresh ingredients, wooden utensils, linens. Clean neutral surface — light oak or matte white. Soft even lighting from all sides, no harsh shadows. Organized yet organic composition with intentional negative space. Editorial catalog style, 8K, top-down perspective",

    // ── 包装与信任 ──
    brand_story: "Premium brand storytelling unboxing photography. Show the complete opening experience: outer packaging box with brand logo, tissue paper partially unwrapped, product nestled in its custom-fit insert, all included accessories neatly fanned out, warranty card and manual placed elegantly. Warm emotional lighting from window, 5000K. Overhead or 45-degree angle. Communicates care, quality, and gift-worthiness. 4K, editorial e-commerce quality, warm and aspirational",
    gift_accessory: "Product photography showing the main product with all included accessories, cables, adapters, or complementary items that come in the box. Everything clearly visible and arranged neatly. For electronics: device + charger + USB cable + case + manual + SIM tool. For beauty: main product + travel size + applicator + pouch. Clean composition on white or light grey surface. Soft even studio lighting, all items equally sharp at f/11. No text labels on image — clean visual inventory. 8K, professional e-commerce quality",
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

  // Double-click guard — skip when using batch detailTypes (multiple types intentionally)
  if (!detailTypes || detailTypes.length === 0) {
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
  }

  // ── Batch detail types: fire all predictions in parallel, poll concurrently ──
  if (detailTypes && detailTypes.length > 0) {
    const productImage = await db.productImage.findUnique({
      where: { id: productImageId },
    });
    if (!productImage) {
      return NextResponse.json({ error: "Product image not found" }, { status: 404 });
    }
    const isR2Image = productImage.s3Key && (productImage.s3Key.startsWith("products/") || productImage.s3Key.startsWith("generated/"));
    const sharedImageUrl = isR2Image
      ? await getSignedGetUrl(productImage.s3Key, 3600).catch(() => productImage.originalUrl)
      : productImage.originalUrl;
    const fluxProvider = getProvider("flux");

    // Update project status
    await db.imageProject.update({
      where: { id: imageProjectId },
      data: { status: "GENERATING", title: projectTitle || undefined },
    });

    // Fire all predictions in parallel
    const detailTypesArray = detailTypes as Array<{ key: string; prompt: string }>;
    const predictions = await Promise.all(
      detailTypesArray.map(async (dt) => {
        const detailPrompt = DETAIL_PROMPTS[dt.key] ?? dt.prompt;
        try {
          const p = await fluxProvider.createPrediction({
            prompt: detailPrompt,
            productImageUrl: sharedImageUrl,
            numOutputs: 1,
            width: 1024,
            height: 1024,
          });
          return { key: dt.key, predictionId: p.predictionId, prompt: detailPrompt };
        } catch {
          return null;
        }
      })
    );

    // Poll all predictions concurrently (shorter timeout — 8 polls × 1.5s = 12s per type)
    const MAX_POLLS = 8;
    const pollOne = async (key: string, predictionId: string, prompt: string) => {
      try {
        let result = await fluxProvider.getPrediction(predictionId);
        let polls = 0;
        while (result.status === "processing" && polls < MAX_POLLS) {
          await new Promise((r) => setTimeout(r, 1500));
          result = await fluxProvider.getPrediction(predictionId);
          polls++;
        }
        if (result.status === "succeeded" && result.outputs.length > 0) {
          const imgUrl = result.outputs[0].url;
          await db.generatedImage.create({
            data: {
              imageProjectId, productImageId,
              s3Key: imgUrl, url: imgUrl, promptUsed: prompt,
              aiProvider: "flux", status: "SUCCEEDED", completedAt: new Date(),
            },
          });
          return { key, url: imgUrl, label: key };
        }
      } catch { /* skip */ }
      return null;
    };

    const generated: Array<{ key: string; url: string; label: string }> = [];
    const pollResults = await Promise.all(
      predictions
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => pollOne(p.key, p.predictionId, p.prompt))
    );
    for (const r of pollResults) {
      if (r) generated.push(r);
    }

    // Mark project as generated
    const pendingCount = await db.task.count({
      where: { imageProjectId, status: { in: ["PENDING", "PROCESSING"] } },
    });
    if (pendingCount === 0) {
      await db.imageProject.update({ where: { id: imageProjectId }, data: { status: "GENERATED" } });
    }

    return NextResponse.json({ generated, count: generated.length });
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
      const succeededImages = await db.generatedImage.findMany({
        where: { id: { in: succeeded } },
        select: { id: true, url: true },
      });
      const firstImg = succeededImages[0];
      const allUrls = succeededImages.map((img) => ({ id: img.id, url: img.url }));

      await db.task.update({ where: { id: task.id }, data: { status: "SUCCEEDED", resultUrl: firstImg?.url ?? "" } });
      await db.imageProject.update({ where: { id: imageProjectId }, data: { status: "GENERATED" } });

      return NextResponse.json({
        taskId: task.id, status: "succeeded",
        generatedImageId: firstImg?.id, url: firstImg?.url ?? "",
        urls: allUrls,
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
