import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { checkGenerationQuota } from "@/lib/lemonsqueezy/billing";

export const maxDuration = 60; // seconds — Vercel Pro max
import { PLATFORM_SPECS } from "@/lib/platform-specs";
import { serverT } from "@/lib/server-t";
import { getSignedGetUrl } from "@/lib/s3";
import { overlayLogo, fetchImageBuffer } from "@/lib/overlay-logo";
import { uploadBuffer, hasS3Config } from "@/lib/s3";
import { prepareReferenceImage } from "@/lib/reference-image";

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
    // Keep prompts purely visual — no negative instructions that confuse img models
    selling_points: "Product centered on pure white background, soft diffused studio lighting 5500K, clean minimal e-commerce packshot, generous empty space around product, 8K sharp focus",
    material: "Extreme macro close-up product photography on white background, 100mm macro lens f/2.8, crisp texture detail, shallow depth of field, soft diffused ring light, premium detail quality, 8K",
    size: "Product on white background next to a standard soda can for scale reference, both equally sharp at f/8, clean studio lighting 5500K, professional size reference photography, 4K",
    craft: "Product on clean white surface, still-life composition showing fine workmanship details, soft directional light raking at 30 degrees, revealing subtle surface texture, clean professional photography, 4K",
    compare: "Split-screen comparison, two views side by side on white background, identical lighting and scale, clean vertical dividing line centered, equally sharp at f/11, professional layout, 8K",

    lifestyle: "Product in a bright modern interior with natural window light, soft daylight 5600K, 50mm lens f/2.2, product sharp in foreground, background softly blurred, editorial magazine quality, warm atmosphere, 4K",
    scene_atmosphere: "Dramatic product photography, product as lone hero, directional lighting, 85mm lens f/1.8 ultra-shallow depth of field, product pin-sharp, cinematic moody atmosphere, 4K",
    in_use: "Product being used by a person, candid mid-action moment, soft daylight 5500K, 50mm lens f/2.0, focus on product, editorial lifestyle photography, warm tones, 4K",
    multi_angle: "Multi-angle product photography composited, front view 45-degree side rear and top-down views, white background, consistent lighting, identical scale across all views, clean grid layout, 8K",
    detail: "Extreme macro close-up of premium quality details, 100mm macro lens f/3.2, very shallow depth of field, soft diffused light, crisp texture visible, 8K",
    color_variants: "Product color variants in clean grid layout on white background, consistent lighting and angle across all variants, equal spacing, professional catalog presentation, 8K",
    flatlay: "Overhead flat lay product photography from directly above, product surrounded by complementary accessories, clean neutral surface, soft even lighting, editorial catalog style, 8K",
    brand_story: "Premium unboxing scene, packaging box tissue paper product in insert accessories arranged, warm window light 5000K, overhead angle, editorial quality, 4K",
    gift_accessory: "Main product with all included accessories neatly arranged on white surface, soft even studio lighting, all items equally sharp at f/11, clean visual inventory, 8K",
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
    const rawBatchUrl = isR2Image
      ? await getSignedGetUrl(productImage.s3Key, 3600).catch(() => productImage.originalUrl)
      : productImage.originalUrl;
    // Compress reference to ≤1MP before sending to Replicate — cuts input-megapixel cost ~70%.
    const sharedImageUrl = await prepareReferenceImage(rawBatchUrl);
    // Prefer FLUX for img2img support (input_images parameter), fallback to any available provider
    let batchProvider;
    try {
      batchProvider = getProvider("flux");
    } catch {
      try {
        batchProvider = getProvider("gpt-image");
      } catch {
        return NextResponse.json({ error: "No AI engine available" }, { status: 400 });
      }
    }

    // Update project status
    await db.imageProject.update({
      where: { id: imageProjectId },
      data: { status: "GENERATING", title: projectTitle || undefined },
    });

    // Fire predictions in parallel, poll concurrently
    const detailTypesArray = detailTypes as Array<{ key: string; prompt: string }>;
    const POLL_MS = 2000;
    const MAX_POLLS = 15;

    const predictions = await Promise.all(
      detailTypesArray.map(async (dt) => {
        const detailPrompt = DETAIL_PROMPTS[dt.key] ?? dt.prompt;
        try {
          const p = await batchProvider.createPrediction({
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

    const generated: Array<{ key: string; url: string; label: string }> = [];
    const results = await Promise.all(
      predictions
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map(async (p) => {
          try {
            let result = await batchProvider.getPrediction(p.predictionId);
            let polls = 0;
            while (result.status === "processing" && polls < MAX_POLLS) {
              await new Promise((r) => setTimeout(r, POLL_MS));
              result = await batchProvider.getPrediction(p.predictionId);
              polls++;
            }
            if (result.status === "succeeded" && result.outputs.length > 0) {
              const imgUrl = result.outputs[0].url;
              await db.generatedImage.create({
                data: {
                  imageProjectId, productImageId,
                  s3Key: imgUrl, url: imgUrl, promptUsed: p.prompt,
                  aiProvider: "flux", status: "SUCCEEDED", completedAt: new Date(),
                },
              });
              return { key: p.key, url: imgUrl, label: p.key };
            }
          } catch { /* skip */ }
          return null;
        })
    );
    for (const r of results) {
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

  // Generate a public presigned URL so Replicate/DeepSeek can access the image.
  // Compress the reference to ≤1MP first — Replicate flux-2-pro bills per input MP,
  // and full-res uploads (avg 3.35MP) were costing ~$0.05/image in input fees.
  const isR2Image = productImage.s3Key && (productImage.s3Key.startsWith("products/") || productImage.s3Key.startsWith("generated/"));
  const rawSharedUrl = isR2Image
    ? await getSignedGetUrl(productImage.s3Key, 3600).catch(() => productImage.originalUrl)
    : productImage.originalUrl;
  const sharedImageUrl = await prepareReferenceImage(rawSharedUrl);

  // Prompt resolution
  let prompt = "Professional product photography, studio lighting, high quality";
  if (detailType && DETAIL_PROMPTS[detailType]) {
    prompt = DETAIL_PROMPTS[detailType];
    if (baseStyle) {
      // Match the main image's lighting, color palette, and overall aesthetic — lock across the entire set.
      // Seed is passed to the provider as a real param (see createPrediction); the prompt carries the
      // style guide text so non-seed-aware engines still get consistency hints.
      prompt = `${prompt}. Use this lighting and color style as a loose guide: ${baseStyle}. Vary the camera angle, product distance, and composition between frames. Same product, same mood, different perspective each time.`;
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

  // Model version mapping for alternative engines (all routed through Replicate).
  // bria is intentionally absent: its provider hardcodes the version internally and
  // never reads modelVersion, so the flux fallback below is harmless for it.
  const ENGINE_MODELS: Record<string, string> = {
    flux: "black-forest-labs/flux-2-pro",
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

  // Gemini-based providers — always async: create task, return taskId, let /api/tasks/[id] do the heavy lifting
  if ((engineType === "gemini" || engineType === "banana" || engineType === "gpt-image") && actualEngine !== "flux") {
    // Store generation params on task so /api/tasks/[id] can pick them up
    await db.task.update({
      where: { id: task.id },
      data: {
        status: "PENDING",
        // Store params as JSON in errorMessage temporarily (will be cleared on success)
        errorMessage: JSON.stringify({
          engineType: actualEngine,
          prompt,
          sharedImageUrl,
          genWidth,
          genHeight,
        }),
      },
    });

    await db.imageProject.update({
      where: { id: imageProjectId },
      data: { status: "GENERATING", title: projectTitle || undefined },
    });

    return NextResponse.json({
      taskId: task.id,
      status: "processing",
      poll: true,
      nextPollMs: 2000,
    });
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
      const mimeType = "image/png";
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

  // ── Bria path: product-preserving background swap ──
  // bria/generate-background takes image_url (product) + bg_prompt (background only).
  // It preserves the product automatically, so we must NOT pass referenceImageUrl,
  // modelVersion, width, or height — bria ignores them and they can confuse the API.
  // The prompt here is already a pure background description (see style-picker: bria
  // reuses promptFlux with the "keep the product identical" clause stripped).
  if (actualEngine === "bria") {
    try {
      const generatedIds: string[] = [];

      for (let i = 0; i < numOutputs; i++) {
        // bria is highly seed-sensitive: a fixed seed + near-identical bg_prompt
        // (the `(variant N)` suffix barely distinguishes backgrounds) produces
        // near-duplicate outputs. The client never sends a seed, so without this
        // each variant would fall back to seed=42 and come out identical. Draw a
        // fresh random seed per variant instead.
        const variantSeed = Math.floor(Math.random() * 2_000_000_000);
        const prediction = await provider.createPrediction({
          prompt: `${prompt} ${i > 0 ? `(variant ${i + 1})` : ""}`,
          productImageUrl: sharedImageUrl,
          numOutputs: 1,
          seed: variantSeed,
        });

        await db.task.update({
          where: { id: task.id },
          data: { predictionId: prediction.predictionId, status: "PROCESSING" },
        });

        const placeholder = await db.generatedImage.create({
          data: {
            imageProjectId, productImageId,
            s3Key: "pending", url: "", promptUsed: prompt,
            aiProvider: "bria", status: "PROCESSING",
            webhookId: prediction.predictionId,
          },
        });

        // bria is async (Replicate) — poll until done.
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
        seed,
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

      // Synchronous providers (flux-kontext-pro, gpt-image) return outputs immediately in
      // createPrediction. Async providers (Replicate flux-2-pro) return processing and need
      // to be polled via getPrediction. Detect which case we're in to avoid a dead poll loop.
      let imageResult;
      if (prediction.outputs && prediction.outputs.length > 0) {
        imageResult = { status: prediction.status as "succeeded" | "failed", outputs: prediction.outputs, error: prediction.error };
      } else if (prediction.status === "failed") {
        imageResult = { status: "failed" as const, outputs: [], error: prediction.error };
      } else {
        imageResult = await provider.getPrediction(prediction.predictionId);
        let polls = 0;
        while (imageResult.status === "processing" && polls < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          imageResult = await provider.getPrediction(prediction.predictionId);
          polls++;
        }
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
