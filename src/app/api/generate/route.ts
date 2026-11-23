import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { configuredVegaImageModel, isTencentVegaConfigured } from "@/lib/ai/tencent-vega";
import { releaseGeneratingProject } from "@/lib/project-status";

// Hobby Fluid Compute default and maximum are both 300 seconds.
// Pro can be configured up to 800. This project is on Hobby, so do not exceed 300.
export const maxDuration = 300;
import { PLATFORM_SPECS } from "@/lib/platform-specs";
import { getSignedGetUrl } from "@/lib/s3";
import { overlayLogo, fetchImageBuffer } from "@/lib/overlay-logo";
import { uploadBuffer, hasS3Config } from "@/lib/s3";
import { isInfoShot } from "@/lib/generate/info-shots";
import { BLANKET_TEXT_BAN, PRESERVE_PRODUCT_LETTERING, shotPreservesProductLettering } from "@/lib/generate/product-lettering";
import { compositeSpecCaption } from "@/lib/spec-caption";
import { prepareReferenceImage } from "@/lib/reference-image";
import { ASYNC_ENGINES, FALLBACK_ENGINES, BRIA_SCENE_TYPES, BEAUTY_DARK_SURFACE_GUARD } from "@/lib/ai/constants";
import { chargeScreenedGeneration, localPlanTier, refundGenerationDebit, type DebitHold } from "@/lib/creem/credits-runtime";
import { spendErrorResponse, withRefundFlag } from "@/lib/creem/http";
import {
  creemModerationMode,
  moderationHttpResponse,
  promptsForModeration,
  SCREEN_PLACEHOLDERS,
  screenGenerationPrompts,
} from "@/lib/creem/moderation";
import { sharedStaticPromptFragments } from "@/lib/creem/static-fragments";
import {
  applyPackPromptGuards,
  BEAUTY_PERSON_CLOSEUP_PROMPT,
  MULTI_ANGLE_DISTINCT_VIEWS,
  NO_SOURCE_WATERMARK,
  packStyleLocked,
  planPackShot,
  PRODUCT_MACRO_LOCK,
  STYLE_LOCK_SAME_PRODUCT,
  type PackShotPlan,
} from "@/lib/generate/detail-shot";
import {
  MIN_START_MS,
  NOT_STARTED_REASON,
  PACK_BUDGET_MS,
} from "@/lib/generate/pack-timing";
import { claimProjectPack, normalizePackIdempotencyKey, type PackLockStore } from "@/lib/generate/pack-run";
import type { PlanTier, Prisma } from "@prisma/client";

function debitSnapshot(value: DebitHold | null): { accountId: string; transactionId: string } | null {
  if (!value) return null;
  return { accountId: value.accountId, transactionId: value.transactionId };
}

// ── Module-level constants ──

// Structured prompt templates — 5-element formula inspired by awesome-gpt-image-2:
// [Subject from user] + [Composition] + [Lighting] + [Camera] + [Technical]
// Subject is user-provided (from enhancer or basePrompt). The rest is per-type defaults.
const TYPE_TEMPLATES: Record<string, {
  composition: string;
  lighting: string;
  camera: string;
  mood: string;
  technical: string;
}> = {
  // ── Scene types (model + real environment) ──
  lifestyle: {
    composition: "Product naturally placed in a beautiful real-world interior or outdoor setting, product sharp in foreground occupying 40% of frame, background softly blurred",
    lighting: "Soft natural daylight 5600K from large windows or open shade, warm neutral undertones, gentle shadows",
    camera: "50mm lens, f/2.2, shallow depth of field, editorial lifestyle composition",
    mood: "Aspirational yet attainable, warm and inviting atmosphere, Kinfolk/Cereal magazine aesthetic",
    technical: "4K, photorealistic, professional product photography, sharp focus on product",
  },
  scene_atmosphere: {
    composition: "Product as lone hero, dramatic center framing with generous negative space, 85% product in frame",
    lighting: "Single dramatic directional key light at 45°, deep rich shadows, controlled specular highlights, cinematic chiaroscuro",
    camera: "85mm lens, f/1.8, ultra-shallow depth of field, product pin-sharp against dramatic bokeh",
    mood: "Cinematic, moody, high-end luxury atmosphere, Byredo/Diptyque editorial aesthetic",
    technical: "4K, photorealistic, maximum quality, cinematic color grading",
  },
  in_use: {
    composition: "Product being actively used or worn by a person, candid mid-action moment, focus on product and interaction area",
    lighting: "Soft diffused daylight 5500K, natural ambient light, no studio feel",
    camera: "50mm lens, f/2.0, shallow depth of field, product in sharp focus, editorial lifestyle quality",
    mood: "Candid and natural, captured moment feel, Everlane/Uniqlo lookbook style, warm genuine atmosphere",
    technical: "4K, photorealistic, editorial lifestyle photography",
  },
  // ── Product detail types ──
  detail: {
    composition: "Extreme close-up filling 90% of frame, focus on texture and material quality, no product packaging visible",
    lighting: "Soft diffused ring light, subtle directional accent at 30° to reveal surface texture, controlled highlights",
    camera: "100mm macro lens, f/2.8, very shallow depth of field, crisp micro-texture detail",
    mood: "Premium craftsmanship reveal, tactile and luxurious feel",
    technical: "8K, maximum sharpness, photorealistic macro photography",
  },
  multi_angle: {
    composition: MULTI_ANGLE_DISTINCT_VIEWS,
    lighting: "Consistent soft studio lighting across all views, same exposure and white balance, so only the camera angle changes",
    camera: "Move the camera between a front view, a side profile near 90 degrees, and a back or opposite-side view. A small turn is not an angle change. Keep the product the same size in each view.",
    mood: "Clean professional catalog presentation, informative and precise",
    technical: "8K, photorealistic, professional product catalog photography",
  },
  flatlay: {
    composition: "Overhead flat lay from directly above, product surrounded by complementary accessories, product at center",
    lighting: "Soft even diffused lighting from two 45° angles, no harsh shadows, clean neutral illumination",
    camera: "35mm lens, f/8 for full frame sharpness, perfectly perpendicular overhead angle",
    mood: "Editorial catalog style, curated and intentional arrangement, Kinfolk flat lay aesthetic",
    technical: "8K, photorealistic, professional flat lay product photography",
  },
  color_variants: {
    composition: "Product color variants in clean horizontal grid, equal spacing, consistent angle and scale across all variants",
    lighting: "Consistent soft studio lighting, identical exposure for accurate color comparison",
    camera: "f/11 for edge-to-edge sharpness, fixed camera position across variants",
    mood: "Professional catalog presentation, clean and informative",
    technical: "8K, photorealistic, professional product catalog photography",
  },
  // ── Info/spec types (white bg + text overlay via Canvas) ──
  selling_points: {
    composition: "Product centered in the upper portion of a pure white infinity background, occupying about 60% of the frame height, with white space on the sides and a clear empty white caption band across the bottom of at least 22% of the frame. Do not let the product touch the bottom edge",
    lighting: "Three-point studio lighting: large softbox key from top-left, subtle fill from front, soft rim from back-right, 5500K",
    camera: "f/8 for full product sharpness, 70mm lens, straight-on product photography angle",
    mood: "Clean minimal e-commerce packshot, pure professional presentation",
    technical: "8K sharp focus, pure white background #FFFFFF, professional e-commerce product photography",
  },
  material: {
    composition: "Extreme macro close-up of product material and texture, filling 90% of frame, clean white background, empty space for text overlay",
    lighting: "Soft diffused ring light, subtle directional accent to reveal surface texture, 5000K",
    camera: "100mm macro lens, f/2.8, very shallow depth of field, crisp micro-texture detail",
    mood: "Premium material showcase, tactile and informative",
    technical: "8K, maximum sharpness, photorealistic macro photography, pure white background",
  },
  size: {
    composition: "Product on pure white background with common reference object for scale comparison, both equally sharp, generous empty space for text overlay",
    lighting: "Clean studio lighting 5500K, even illumination, no shadows on background",
    camera: "f/8 for full depth of field, 50mm lens, straight-on angle",
    mood: "Professional size reference photography, clean and informative",
    technical: "4K, photorealistic, professional product photography, pure white background",
  },
  craft: {
    composition: "Product on clean white surface, still-life composition revealing workmanship details, empty space for text overlay",
    lighting: "Soft directional key light raking at 30° to reveal surface texture and craftsmanship, subtle fill at 10%",
    camera: "85mm lens, f/5.6, shallow depth of field highlighting craftsmanship details",
    mood: "Artisanal quality reveal, craftsmanship and attention to detail",
    technical: "4K, photorealistic, professional product photography, pure white background",
  },
  compare: {
    composition: "Split-screen comparison layout: before/after or version A/B side by side on pure white background, clean vertical dividing line centered, identical lighting and scale both sides",
    lighting: "Consistent studio lighting 5500K both sides, identical exposure",
    camera: "f/11 for edge-to-edge sharpness both sides, identical focal length",
    mood: "Professional comparison presentation, clean and informative, empty space for text overlay",
    technical: "8K, photorealistic, professional product comparison photography, pure white background",
  },
  // ── Brand/experience types ──
  brand_story: {
    composition: "Premium unboxing scene: packaging box open, tissue paper draped, product nestled in insert, accessories arranged around, overhead or 45° angle",
    lighting: "Warm window light 5000K, soft natural illumination, gentle wrap-around shadows",
    camera: "50mm lens, f/4, slight overhead angle, editorial quality",
    mood: "Premium unboxing experience, anticipation and luxury, editorial magazine quality",
    technical: "4K, photorealistic, premium editorial product photography",
  },
  gift_accessory: {
    composition: "Main product centered with all included accessories neatly arranged around it on clean white surface, visual inventory layout",
    lighting: "Soft even studio lighting from two 45° angles, all items equally illuminated, no shadows",
    camera: "f/11 for edge-to-edge sharpness across all items, 50mm lens",
    mood: "Clean visual inventory, professional and comprehensive",
    technical: "8K, photorealistic, professional product photography, pure white background",
  },
};

// Category → default style + recommended detail types + composition hint.
// When user selects a category, the frontend auto-selects recommended types
// and sets the matching style for visual consistency.
const CATEGORY_PROFILES: Record<string, {
  name: string;
  defaultStyle: string;     // STYLE_GUIDANCE key
  recommendedTypes: string[]; // detail type keys to pre-select
  compositionHint: string;  // extra composition direction for enhancer
}> = {
  beauty: {
    name: "美妆护肤",
    defaultStyle: "dark_moody",
    recommendedTypes: ["selling_points", "detail", "material", "craft", "lifestyle", "scene_atmosphere"],
    compositionHint: "High-end beauty product, glossy reflections, premium packaging, dark matte charcoal or near-black wood surface, cool cyan-blue rim light, luxury cosmetic aesthetic",
  },
  fashion: {
    name: "服饰配饰",
    defaultStyle: "in_use",
    recommendedTypes: ["in_use", "multi_angle", "detail", "flatlay", "color_variants", "lifestyle"],
    compositionHint: "Garment or accessory worn by model, natural body language, candid lifestyle moment, soft natural lighting, editorial fashion lookbook style",
  },
  electronics: {
    name: "3C数码",
    defaultStyle: "dark_moody",
    recommendedTypes: ["selling_points", "multi_angle", "detail", "compare", "lifestyle", "scene_atmosphere"],
    compositionHint: "Sleek tech product, dramatic chiaroscuro lighting, matte dark surfaces, neon accent rim lights, futuristic high-tech atmosphere",
  },
  food: {
    name: "食品饮料",
    defaultStyle: "natural",
    recommendedTypes: ["selling_points", "detail", "material", "flatlay", "lifestyle", "brand_story"],
    compositionHint: "Fresh natural ingredients, golden hour warm light, organic textures, rustic wood or ceramic surfaces, wellness-lifestyle mood",
  },
  home: {
    name: "家居生活",
    defaultStyle: "cosy",
    recommendedTypes: ["lifestyle", "scene_atmosphere", "in_use", "multi_angle", "flatlay", "brand_story"],
    compositionHint: "Warm hygge interior, soft window light through linen, Scandinavian-Japandi aesthetic, natural textures, serene and grounded atmosphere",
  },
  general: {
    name: "通用",
    defaultStyle: "white",
    recommendedTypes: ["selling_points", "detail", "multi_angle", "lifestyle"],
    compositionHint: "Clean professional e-commerce presentation, pure white background, three-point studio lighting, crisp product focus",
  },
};

// Detail types where GPT Image 2 (via OpenAI) produces better results than FLUX.
// These are white-bg info types where text rendering and clean layouts matter.
const GPT_IMAGE_TYPES = new Set(["selling_points", "compare", "size"]);

/**
 * Pick the engine for one pack shot.
 * selling_points / compare / size stay on OpenAI, then flux.
 * Every other pack shot uses Vega when it is registered, then flux.
 * Single-image generation does not call this.
 */
function getEngineForDetailType(detailKey: string): { provider: ReturnType<typeof getProvider>; engine: string } {
  if (GPT_IMAGE_TYPES.has(detailKey)) {
    try { return { provider: getProvider("openai"), engine: "openai" }; } catch {}
    return { provider: getProvider("flux"), engine: "flux" };
  }
  if (isTencentVegaConfigured()) {
    try { return { provider: getProvider("vega"), engine: "vega" }; } catch {}
  }
  return { provider: getProvider("flux"), engine: "flux" };
}

// Model version mapping for engines routed through Replicate.
// bria is intentionally absent: its provider hardcodes the version internally.
const ENGINE_MODELS: Record<string, string> = {
  flux: "black-forest-labs/flux-2-pro",
  sdxl: "stability-ai/sdxl",
  playground: "playgroundai/playground-v2.5-1024px-aesthetic",
};

/** Model id stored on the image. Vega's value is the model that was called, never a secret. */
function modelVersionForEngine(engine: string, provider: { model?: string } | undefined): string | undefined {
  if (engine === "vega") {
    const fromProvider = typeof provider?.model === "string" ? provider.model.trim() : "";
    if (fromProvider) return fromProvider;
    return configuredVegaImageModel();
  }
  if (engine === "openai") return "gpt-image-2";
  return ENGINE_MODELS[engine];
}

const PERSIST_ATTEMPTS = 3;
const PERSIST_RETRY_MS = 150;

/**
 * Copy a provider image onto our storage as soon as the bytes are in hand.
 * Retries a timed-out fetch (a US function pulling Shanghai COS) and only then
 * keeps the provider URL. The URL is not logged: signed provider URLs can carry secrets.
 * A failed transfer is not reported as our file.
 */
async function reuploadGeneratedImage(input: {
  sourceUrl: string;
  buffer?: Buffer;
  mimeType: string;
  generatedImageId: string;
}): Promise<string> {
  if (!hasS3Config()) return input.sourceUrl;
  let lastMessage = "persist_failed";
  for (let attempt = 1; attempt <= PERSIST_ATTEMPTS; attempt += 1) {
    try {
      const imageBuf = input.buffer ?? await fetchImageBuffer(input.sourceUrl, 12_000);
      const uploaded = await uploadBuffer(imageBuf, input.mimeType || "image/png", "generated/");
      await db.generatedImage.update({
        where: { id: input.generatedImageId },
        data: { url: uploaded.publicUrl, s3Key: uploaded.s3Key },
      });
      return uploaded.publicUrl;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "persist_failed";
      console.error(`Failed to persist generated image (attempt ${attempt}/${PERSIST_ATTEMPTS}): ${lastMessage}`);
      if (attempt < PERSIST_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, PERSIST_RETRY_MS * attempt));
      }
    }
  }
  console.error("Generated image persistence failed after retries; keeping the provider URL");
  return input.sourceUrl;
}

/**
 * Re-upload a generated image to R2 (so it doesn't expire) and optionally apply a
 * brand logo overlay for non-FREE users. Returns the final URL and updates the
 * generatedImage DB record in place.
 * `sourceBuffer` is the image to store, including a spec caption already drawn on it.
 */
async function postProcessImage(
  imageUrl: string,
  mimeType: string,
  generatedImageId: string,
  brandPreset: { logoUrl?: string | null } | null,
  quotaTier: string,
  sourceBuffer?: Buffer,
): Promise<string> {
  let finalUrl = await reuploadGeneratedImage({
    sourceUrl: imageUrl,
    buffer: sourceBuffer,
    mimeType,
    generatedImageId,
  });

  // Apply brand logo overlay if present (non-FREE users)
  const presetLogo = brandPreset?.logoUrl;
  if (presetLogo && quotaTier !== "FREE") {
    try {
      const imageBuf = await fetchImageBuffer(finalUrl);
      const logoUrl = await getSignedGetUrl(presetLogo).catch(() => presetLogo);
      const logoBuf = await fetchImageBuffer(logoUrl);
      const overlaid = await overlayLogo(imageBuf, logoBuf);
      if (hasS3Config()) {
        const { publicUrl: newUrl } = await uploadBuffer(overlaid, "image/png", "generated/");
        await db.generatedImage.update({
          where: { id: generatedImageId },
          data: { url: newUrl, s3Key: newUrl },
        });
        finalUrl = newUrl;
      }
    } catch { /* keep un-overlaid image */ }
  }

  return finalUrl;
}

/**
 * Poll a prediction until it completes or times out.
 * Used by both the sync-generation and batch paths.
 */
async function pollPrediction(
  provider: ReturnType<typeof getProvider>,
  predictionId: string,
  pollMs: number = 1000,
  maxPolls: number = 30,
) {
  let result = await provider.getPrediction(predictionId);
  let polls = 0;
  while (result.status === "processing" && polls < maxPolls) {
    await new Promise((r) => setTimeout(r, pollMs));
    result = await provider.getPrediction(predictionId);
    polls++;
  }
  return result;
}

/** Static copy the model sees. Creem screens user text, or a placeholder when none remains. */
function generationStaticFragments(): string[] {
  const fragments = sharedStaticPromptFragments();
  for (const template of Object.values(TYPE_TEMPLATES)) {
    fragments.push(template.composition, template.lighting, template.camera, template.mood, template.technical);
  }
  for (const profile of Object.values(CATEGORY_PROFILES)) {
    fragments.push(profile.compositionHint);
  }
  fragments.push(
    BEAUTY_DARK_SURFACE_GUARD,
    "CRITICAL: Keep the product and any person visually IDENTICAL to the reference image — same shape, same color, same materials, same details. Only change the background, scene, pose, framing, or camera angle. Do NOT substitute the product with a different one.",
    "CRITICAL: do NOT render any text, words, letters, labels, numbers, or writing on the image.",
    PRESERVE_PRODUCT_LETTERING,
    "Keep any person visually identical to the reference image — same face, same body, same clothing.",
    BEAUTY_PERSON_CLOSEUP_PROMPT,
    PRODUCT_MACRO_LOCK,
    STYLE_LOCK_SAME_PRODUCT,
    MULTI_ANGLE_DISTINCT_VIEWS,
    NO_SOURCE_WATERMARK,
  );
  return fragments;
}

type DetailShotInput = { key?: unknown; prompt?: unknown; specText?: unknown };

function detailShotList(value: unknown): Array<{ key: string; prompt: string; specText: string }> {
  if (!Array.isArray(value)) return [];
  const shots: Array<{ key: string; prompt: string; specText: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as DetailShotInput;
    if (typeof record.key !== "string" || !record.key.trim()) continue;
    shots.push({
      key: record.key.trim(),
      prompt: typeof record.prompt === "string" ? record.prompt : "",
      specText: typeof record.specText === "string" ? record.specText.trim() : "",
    });
  }
  return shots;
}

function withoutSpecText(prompt: string, specText: string): string {
  const spec = specText.trim();
  if (!spec || !prompt.includes(spec)) return prompt;
  return prompt.split(spec).join(" ").replace(/\s+/g, " ").trim();
}

function assemblePackPrompt(
  dt: { key: string; prompt: string; specText?: string },
  plan: PackShotPlan,
  input: { baseStyle?: string; referenceImageUrl?: string; category?: string },
): string {
  const styleLocked = packStyleLocked(input);
  if (plan.promptOverride) {
    return applyPackPromptGuards(plan.promptOverride, { detailKey: dt.key, styleLocked });
  }
  const infoShot = isInfoShot(dt.key);
  const specText = dt.specText?.trim() ?? "";
  const supplied = dt.prompt && dt.prompt !== dt.key ? withoutSpecText(dt.prompt, specText) : "";
  // Info shots are a clean product photo. Spec text is composited afterwards and must not be painted by the model.
  const userPrompt = infoShot ? "" : supplied;
  const tpl = TYPE_TEMPLATES[dt.key];
  const catProfile = input.category ? CATEGORY_PROFILES[input.category] : null;
  const categoryHint = !plan.omitCategoryHint && catProfile?.compositionHint
    ? ` ${catProfile.compositionHint}.`
    : "";
  const wantsTextOnImage = !infoShot && /(write|text|label|overlay|render.*word|render.*text|add.*text|写|字|标注|文字|打上|印上|加上字|显示文字)/i.test(userPrompt);
  const styleHint = !infoShot && input.baseStyle && !wantsTextOnImage
    ? ` Keep the same overall style, material, and color: ${input.baseStyle}.`
    : "";
  const identityLock = input.referenceImageUrl && !wantsTextOnImage && plan.mode !== "product_macro" && dt.key !== "multi_angle"
    ? " Keep any person visually identical to the reference image — same face, same body, same clothing."
    : "";
  // Product-showing shots keep printed brand lettering. The blanket ban erases it.
  // Spec text is not part of this prompt; info shots overlay it after generation.
  const preserveLettering = infoShot || shotPreservesProductLettering(dt.key);
  const noTextGuard = preserveLettering
    ? ` ${PRESERVE_PRODUCT_LETTERING}`
    : wantsTextOnImage
      ? ""
      : ` CRITICAL: ${BLANKET_TEXT_BAN}, numbers, or writing on the image.`;
  const beautySurfaceGuard = input.category === "beauty" ? BEAUTY_DARK_SURFACE_GUARD : "";
  const body = tpl
    ? [
        identityLock,
        styleHint,
        userPrompt || "Professional product photography",
        categoryHint,
        tpl.composition,
        tpl.lighting,
        tpl.camera,
        tpl.mood,
        tpl.technical,
        noTextGuard,
        beautySurfaceGuard,
      ].filter(Boolean).join(". ").trim()
    : `${identityLock}${styleHint} ${userPrompt || "Professional product photography"}.${categoryHint} ${noTextGuard}${beautySurfaceGuard ? ` ${beautySurfaceGuard}` : ""}`.trim();
  const withMacro = plan.mode === "product_macro" ? `${body} ${PRODUCT_MACRO_LOCK}`.trim() : body;
  const guarded = applyPackPromptGuards(withMacro, { detailKey: dt.key, styleLocked });
  return specText ? withoutSpecText(guarded, specText) : guarded;
}

/**
 * One moderation id and one 1-credit debit per pack shot.
 * The debit is taken when that shot starts, not for the whole pack up front.
 * A failed shot is stored as FAILED and only that shot's debit is reversed.
 * A shot that has not started is not labeled prediction_timeout and is not debited.
 * A started shot keeps polling until the pack budget, not a shorter per-shot cap.
 * Later shots are submitted before earlier shots finish, then polled together.
 * If the provider returns an image after that budget, that image is stored
 * and its debit is kept.
 * The same packIdempotencyKey joins this run instead of debiting a second pack.
 * Holds that were taken but not stored are reversed before the handler returns.
 * Identical outputs of one prompt may still share a debit on the single-image path.
 */
export async function generateDetailPack(input: {
  userId: string;
  imageProjectId: string;
  productImageId: string;
  detailTypes: unknown;
  baseStyle?: string;
  referenceImageUrl?: string;
  referenceHasPerson?: boolean;
  seed?: number;
  category?: string;
  projectTitle?: string;
  /** Clock for the pack deadline. Tests advance it; production uses Date.now. */
  now?: () => number;
  /** One click. A repeat of this key does not debit or persist another pack. */
  packIdempotencyKey?: string;
  /** Tests skip the real poll gap. Production waits between parallel reads. */
  sleep?: (ms: number) => Promise<void>;
}): Promise<NextResponse> {
  const shots = detailShotList(input.detailTypes);
  if (shots.length === 0) {
    return NextResponse.json({ error: "detailTypes are required" }, { status: 400 });
  }

  const project = await db.imageProject.findUnique({ where: { id: input.imageProjectId } });
  if (!project || project.userId !== input.userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const productImage = await db.productImage.findUnique({ where: { id: input.productImageId } });
  if (!productImage) {
    return NextResponse.json({ error: "Product image not found" }, { status: 404 });
  }

  const packKey = normalizePackIdempotencyKey(input.packIdempotencyKey);
  const releasePackLock = async () => {
    if (!packKey) return;
    try {
      await db.imageProject.update({
        where: { id: input.imageProjectId },
        data: { activePackSettled: true },
      });
    } catch (error) {
      console.error("Failed to release pack lock", error);
    }
  };
  if (packKey) {
    const store: PackLockStore = {
      findProject: async (imageProjectId) => db.imageProject.findUnique({
        where: { id: imageProjectId },
        select: {
          userId: true,
          activePackKey: true,
          activePackStartedAt: true,
          activePackSettled: true,
        },
      }),
      claim: async (claim) => {
        const updated = await db.imageProject.updateMany({
          where: {
            id: claim.imageProjectId,
            userId: claim.userId,
            activePackKey: claim.previousKey,
            activePackSettled: claim.previousSettled,
          },
          data: {
            activePackKey: claim.idempotencyKey,
            activePackStartedAt: claim.now,
            activePackSettled: false,
          },
        });
        return updated.count;
      },
    };
    const claim = await claimProjectPack(store, {
      imageProjectId: input.imageProjectId,
      userId: input.userId,
      idempotencyKey: packKey,
      now: input.now?.(),
    });
    if (claim === "missing") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (claim === "join") {
      return NextResponse.json({
        status: "pack_in_progress",
        packIdempotencyKey: packKey,
        poll: true,
      }, { status: 202 });
    }
  }

  const fragments = generationStaticFragments();
  const gates = [];
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const gate = await screenGenerationPrompts({
      userId: input.userId,
      prompts: promptsForModeration(
        { prompt: shot.prompt, baseStyle: input.baseStyle, detailTypes: [shot] },
        fragments,
      ),
      placeholder: SCREEN_PLACEHOLDERS.generate,
      combine: true,
      externalSuffix: `pack-${index}-${shot.key}`,
    });
    const blocked = moderationHttpResponse(gate);
    if (blocked) {
      await releasePackLock();
      return blocked;
    }
    gates.push(gate);
  }

  const isR2Image = productImage.s3Key && (productImage.s3Key.startsWith("products/") || productImage.s3Key.startsWith("generated/"));
  const rawBatchUrl = isR2Image
    ? await getSignedGetUrl(productImage.s3Key, 3600).catch(() => productImage.originalUrl)
    : productImage.originalUrl;
  const sharedImageUrl = await prepareReferenceImage(rawBatchUrl);

  try {
    getProvider("flux");
  } catch {
    try {
      getProvider("gpt-image");
    } catch {
      try {
        getProvider("vega");
      } catch {
        await releasePackLock();
        return NextResponse.json({ error: "No AI engine available" }, { status: 400 });
      }
    }
  }

  const generationId = packKey ?? crypto.randomUUID();

  await db.imageProject.update({
    where: { id: input.imageProjectId },
    data: { status: "GENERATING", title: input.projectTitle || undefined },
  });

  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  // Close out before the Hobby 300s kill. Shots that never start are not timeouts.
  const packDeadline = now() + PACK_BUDGET_MS;

  type Attempt = {
    key: string;
    prompt: string;
    specText: string;
    engine: string;
    modelVersion?: string;
    hold: DebitHold | null;
    predictionId?: string;
    outputs?: Array<{ url: string }>;
    error?: string;
  };

  const generated: Array<{ key: string; url: string; label: string; id: string }> = [];
  const failed: Array<{ key: string; reason: string; creditsRefunded: boolean; charged: boolean }> = [];
  let creditsRefunded = 0;
  let creditsCharged = 0;
  /** Debits taken for a shot that is not stored yet. Cleared on store or refund. */
  const unsettled = new Map<string, DebitHold>();
  const packRows: Array<{ id: string; generationMeta: Record<string, unknown> }> = [];
  let vegaModelVersion: string | undefined;

  function trackHold(hold: DebitHold | null) {
    if (hold) unsettled.set(hold.transactionId, hold);
  }

  function forgetHold(hold: DebitHold | null) {
    if (hold) unsettled.delete(hold.transactionId);
  }

  function planShot(shot: { key: string; prompt: string; specText: string }) {
    const plan = planPackShot({
      detailKey: shot.key,
      category: input.category,
      productImageUrl: sharedImageUrl,
      referenceImageUrl: input.referenceImageUrl,
      referenceHasPerson: input.referenceHasPerson,
      contextText: [input.baseStyle, shot.prompt].filter(Boolean).join("\n"),
    });
    const picked = getEngineForDetailType(shot.key);
    const modelVersion = modelVersionForEngine(picked.engine, picked.provider as { model?: string });
    if (picked.engine === "vega" && modelVersion) vegaModelVersion = modelVersion;
    return {
      plan,
      prompt: assemblePackPrompt(shot, plan, input),
      engine: picked.engine,
      modelVersion,
      provider: picked.provider,
    };
  }

  function shotMeta(attempt: Attempt, extra?: Record<string, unknown>): Record<string, unknown> {
    return {
      sourceType: "detail",
      detailKey: attempt.key,
      packId: generationId,
      ...(attempt.hold
        ? { creemDebit: { accountId: attempt.hold.accountId, transactionId: attempt.hold.transactionId } }
        : {}),
      ...extra,
    };
  }

  function rememberPackRow(created: { id?: string } | null | undefined, generationMeta: Record<string, unknown>) {
    if (created?.id) packRows.push({ id: created.id, generationMeta });
  }

  async function settleFailure(attempt: Attempt, reason: string) {
    const charged = Boolean(attempt.hold);
    const refunded = attempt.hold ? (await refundGenerationDebit(attempt.hold)).reversed : false;
    forgetHold(attempt.hold);
    if (refunded) creditsRefunded += 1;
    const message = reason.slice(0, 500) || "generation_failed";
    const meta = shotMeta(attempt, refunded ? { creditsRefunded: true } : {});
    try {
      const created = await db.generatedImage.create({
        data: {
          imageProjectId: input.imageProjectId,
          productImageId: input.productImageId,
          s3Key: "failed",
          url: "",
          promptUsed: attempt.prompt,
          aiProvider: attempt.engine,
          ...(attempt.modelVersion ? { modelVersion: attempt.modelVersion } : {}),
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
          generationMeta: meta as Prisma.InputJsonValue,
        },
      });
      rememberPackRow(created, meta);
      await db.task.create({
        data: {
          imageProjectId: input.imageProjectId,
          productImageId: input.productImageId,
          engineType: attempt.engine,
          status: "FAILED",
          errorMessage: message,
          generationMeta: meta as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      console.error("Failed to persist pack failure", error);
    }
    failed.push({ key: attempt.key, reason: message, creditsRefunded: refunded, charged });
  }

  async function storeSuccess(attempt: Attempt, providerUrl: string) {
    const spec = isInfoShot(attempt.key) ? attempt.specText.trim() : "";
    let captioned: Buffer | undefined;
    if (spec) {
      try {
        const source = await fetchImageBuffer(providerUrl, 12_000);
        captioned = await compositeSpecCaption(source, spec);
      } catch (error) {
        const message = error instanceof Error ? error.message : "caption_overlay_failed";
        console.error(`Spec caption overlay failed: ${message}`);
        await settleFailure(attempt, "caption_overlay_failed");
        return;
      }
    }

    const meta = shotMeta(attempt);
    const created = await db.generatedImage.create({
      data: {
        imageProjectId: input.imageProjectId,
        productImageId: input.productImageId,
        s3Key: providerUrl,
        url: providerUrl,
        promptUsed: attempt.prompt,
        aiProvider: attempt.engine,
        ...(attempt.modelVersion ? { modelVersion: attempt.modelVersion } : {}),
        status: "SUCCEEDED",
        completedAt: new Date(),
        generationMeta: meta as Prisma.InputJsonValue,
      },
    });
    rememberPackRow(created, meta);
    const imageId = created?.id ? String(created.id) : "";

    let finalUrl = providerUrl;
    if (imageId) {
      try {
        finalUrl = await postProcessImage(
          providerUrl,
          "image/png",
          imageId,
          null,
          "FREE",
          captioned,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "persist_failed";
        console.error(`Pack image persistence failed: ${message}`);
        finalUrl = providerUrl;
      }
    }

    // A caption that never landed in our storage must not look like a finished image.
    if (spec && finalUrl === providerUrl) {
      const refunded = attempt.hold ? (await refundGenerationDebit(attempt.hold)).reversed : false;
      forgetHold(attempt.hold);
      if (refunded) creditsRefunded += 1;
      if (imageId) {
        try {
          await db.generatedImage.update({
            where: { id: imageId },
            data: {
              status: "FAILED",
              errorMessage: "caption_not_persisted",
              url: "",
              s3Key: "failed",
            },
          });
        } catch (error) {
          console.error("Failed to record caption persistence failure", error);
        }
      }
      failed.push({
        key: attempt.key,
        reason: "caption_not_persisted",
        creditsRefunded: refunded,
        charged: Boolean(attempt.hold),
      });
      return;
    }

    forgetHold(attempt.hold);
    if (imageId && finalUrl !== providerUrl) {
      try {
        await db.generatedImage.update({
          where: { id: imageId },
          data: {
            status: "SUCCEEDED",
            url: finalUrl,
            completedAt: new Date(),
          },
        });
      } catch (error) {
        console.error("Failed to mark pack image succeeded", error);
      }
    }
    generated.push({ key: attempt.key, url: finalUrl, label: attempt.key, id: imageId });
    if (attempt.hold) creditsCharged += 1;
    try {
      await db.task.create({
        data: {
          imageProjectId: input.imageProjectId,
          productImageId: input.productImageId,
          engineType: attempt.engine,
          status: "SUCCEEDED",
          resultUrl: finalUrl,
          predictionId: attempt.predictionId,
          generationMeta: meta as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      console.error("Failed to persist pack task", error);
    }
  }

  let chargeBlocked: NextResponse | null = null;
  const inflight: Array<{ attempt: Attempt; provider: ReturnType<typeof getProvider> }> = [];

  async function pollInflight(
    pending: Array<{ attempt: Attempt; provider: ReturnType<typeof getProvider> }>,
  ) {
    const reads = await Promise.all(pending.map(async (item) => {
      try {
        const result = await item.provider.getPrediction(item.attempt.predictionId!);
        return { item, result, error: null as string | null };
      } catch (error) {
        return {
          item,
          result: null,
          error: error instanceof Error ? error.message : "prediction_failed",
        };
      }
    }));
    const still: typeof pending = [];
    for (const read of reads) {
      if (read.error || !read.result) {
        await settleFailure(read.item.attempt, read.error || "prediction_failed");
        continue;
      }
      const url = read.result.outputs?.[0]?.url || "";
      if (url) {
        try {
          await storeSuccess(read.item.attempt, url);
        } catch (error) {
          await settleFailure(read.item.attempt, error instanceof Error ? error.message : "result_not_stored");
        }
        continue;
      }
      if (read.result.status === "failed" || read.result.error) {
        await settleFailure(read.item.attempt, read.result.error || "no_output");
        continue;
      }
      still.push(read.item);
    }
    return still;
  }

  try {
    for (let index = 0; index < shots.length; index += 1) {
      const shot = shots[index];
      const planned = planShot(shot);
      const baseAttempt = {
        key: shot.key,
        prompt: planned.prompt,
        specText: shot.specText,
        engine: planned.engine,
        modelVersion: planned.modelVersion,
      };

      if (packDeadline - now() < MIN_START_MS) {
        await settleFailure({ ...baseAttempt, hold: null }, NOT_STARTED_REASON);
        continue;
      }

      let hold: DebitHold | null = null;
      if (creemModerationMode() !== "off") {
        const charged = await chargeScreenedGeneration({
          userId: input.userId,
          gate: gates[index],
          imageCount: 1,
          reference: `gen:${generationId}:${index}:${shot.key}`,
          idempotencyKey: `debit:${generationId}:${index}:${shot.key}`,
        });
        if (!charged.ok) {
          const message = charged.error;
          for (let rest = index; rest < shots.length; rest += 1) {
            const restShot = shots[rest];
            const restPlan = rest === index ? planned : planShot(restShot);
            await settleFailure({
              key: restShot.key,
              prompt: restPlan.prompt,
              specText: restShot.specText,
              engine: restPlan.engine,
              modelVersion: restPlan.modelVersion,
              hold: null,
            }, message);
          }
          if (generated.length === 0) chargeBlocked = spendErrorResponse(charged);
          break;
        }
        hold = charged.hold;
        trackHold(hold);
      }

      let attempt: Attempt;
      try {
        const prediction = await planned.provider.createPrediction({
          prompt: planned.prompt,
          productImageUrl: planned.plan.productImageUrl,
          referenceImageUrl: planned.plan.referenceImageUrl,
          numOutputs: 1,
          width: 1024,
          height: 1024,
          seed: input.seed || undefined,
        });
        attempt = {
          ...baseAttempt,
          hold,
          predictionId: prediction.predictionId,
          outputs: prediction.outputs,
        };
      } catch (error) {
        attempt = {
          ...baseAttempt,
          hold,
          error: error instanceof Error ? error.message : "prediction_failed",
        };
      }

      if (attempt.error || !attempt.predictionId) {
        await settleFailure(attempt, attempt.error || "prediction_failed");
        continue;
      }

      const syncUrl = attempt.outputs?.[0]?.url;
      if (syncUrl) {
        try {
          await storeSuccess(attempt, syncUrl);
        } catch (error) {
          await settleFailure(attempt, error instanceof Error ? error.message : "result_not_stored");
        }
        continue;
      }

      // Submit the rest of this pack before waiting on this shot.
      inflight.push({ attempt, provider: planned.provider });
    }

    let pending = inflight;
    if (pending.length > 0) {
      pending = await pollInflight(pending);
      while (pending.length > 0 && now() < packDeadline) {
        await sleep(2_000);
        pending = await pollInflight(pending);
      }
      if (pending.length > 0) {
        const late = await Promise.all(pending.map(async (item) => {
          try {
            const result = await item.provider.getPrediction(item.attempt.predictionId!);
            return { item, result };
          } catch (error) {
            console.error("Pack late prediction read failed", error);
            return { item, result: null };
          }
        }));
        for (const read of late) {
          const url = read.result?.outputs?.[0]?.url || "";
          if (url) {
            try {
              await storeSuccess(read.item.attempt, url);
            } catch (error) {
              await settleFailure(read.item.attempt, error instanceof Error ? error.message : "result_not_stored");
            }
            continue;
          }
          if (read.result && (read.result.status === "failed" || read.result.error)) {
            await settleFailure(read.item.attempt, read.result.error || "no_output");
            continue;
          }
          await settleFailure(read.item.attempt, "prediction_timeout");
        }
      }
    }
  } finally {
    for (const hold of unsettled.values()) {
      const refunded = (await refundGenerationDebit(hold)).reversed;
      if (refunded) creditsRefunded += 1;
    }
    unsettled.clear();
  }

  const creditsNotCharged = failed.filter((shot) => !shot.charged).length;
  const packCredit = {
    id: generationId,
    finishedAt: new Date().toISOString(),
    requested: shots.length,
    completed: generated.length,
    creditsCharged,
    creditsRefunded,
    creditsNotCharged,
    failed,
  };
  for (const row of packRows) {
    try {
      await db.generatedImage.update({
        where: { id: row.id },
        data: {
          generationMeta: { ...row.generationMeta, packCredit } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      console.error("Failed to persist pack credit summary", error);
    }
  }

  // Same close-out for a blocked first debit and for a pack that produced nothing.
  // Otherwise the early 402 leaves the project on GENERATING.
  const pendingCount = await db.task.count({
    where: { imageProjectId: input.imageProjectId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  const lockFlag = packKey ? { activePackSettled: true as const } : {};
  if (pendingCount === 0) {
    await db.imageProject.update({
      where: { id: input.imageProjectId },
      data: generated.length > 0
        ? { status: "GENERATED", errorMessage: null, ...lockFlag }
        : { status: "FAILED", errorMessage: failed[0]?.reason || "All predictions failed", ...lockFlag },
    });
  } else if (packKey) {
    await releasePackLock();
  }

  const engineFields = vegaModelVersion
    ? { engine: "vega" as const, modelVersion: vegaModelVersion }
    : {};

  if (chargeBlocked && generated.length === 0) {
    const spend = await chargeBlocked.json() as Record<string, unknown>;
    return NextResponse.json({
      ...spend,
      generated,
      failed,
      requested: shots.length,
      completed: 0,
      count: 0,
      creditsCharged,
      creditsRefunded,
      creditsNotCharged,
      ...engineFields,
    }, { status: chargeBlocked.status });
  }

  const body = {
    generated,
    failed,
    requested: shots.length,
    completed: generated.length,
    count: generated.length,
    creditsCharged,
    creditsRefunded,
    creditsNotCharged,
    ...engineFields,
  };
  if (generated.length === 0) {
    return NextResponse.json(
      { error: "generation_failed", message: failed[0]?.reason || "All predictions failed", ...body },
      { status: 500 },
    );
  }
  return NextResponse.json(body);
}

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
    referenceImageUrl,
    referenceHasPerson,
    seed,
    category, // product category for template matching
    packIdempotencyKey,
  } = await req.json();

  if (Array.isArray(detailTypes) && detailTypes.length > 0) {
    if (!imageProjectId || !productImageId) {
      return NextResponse.json(
        { error: "imageProjectId and productImageId are required" },
        { status: 400 },
      );
    }
    return generateDetailPack({
      userId,
      imageProjectId,
      productImageId,
      detailTypes,
      baseStyle,
      referenceImageUrl,
      referenceHasPerson: typeof referenceHasPerson === "boolean" ? referenceHasPerson : undefined,
      seed: typeof seed === "number" ? seed : undefined,
      category: typeof category === "string" ? category : undefined,
      projectTitle,
      packIdempotencyKey: typeof packIdempotencyKey === "string" ? packIdempotencyKey : undefined,
    });
  }

  // Track which engine will actually be used (may fall back to flux at resolve time)
  let actualEngine = engineType;

  if (!imageProjectId || !productImageId) {
    return NextResponse.json(
      { error: "imageProjectId and productImageId are required" },
      { status: 400 }
    );
  }

  // Screen before any task, queue, debit, or model call. Static templates are
  // stripped. A request with no user text is still screened via a placeholder.
  const moderation = await screenGenerationPrompts({
    userId,
    prompts: promptsForModeration(
      { prompt: customPrompt, baseStyle, detailTypes },
      generationStaticFragments(),
    ),
    placeholder: SCREEN_PLACEHOLDERS.generate,
    combine: true,
  });
  const blocked = moderationHttpResponse(moderation);
  if (blocked) return blocked;

  const generationId = crypto.randomUUID();
  let hold: DebitHold | null = null;
  let spendTier: PlanTier = "FREE";
  let producedCount = 0;

  async function charge(imageCount: number): Promise<NextResponse | null> {
    if (creemModerationMode() === "off") {
      spendTier = await localPlanTier(userId);
      return null;
    }
    const result = await chargeScreenedGeneration({
      userId,
      gate: moderation,
      imageCount,
      reference: `gen:${generationId}`,
      idempotencyKey: `debit:${generationId}`,
    });
    if (!result.ok) return spendErrorResponse(result);
    hold = result.hold;
    spendTier = result.tier;
    return null;
  }

  async function fail(response: NextResponse): Promise<NextResponse> {
    const current = hold;
    // A partial success keeps the debit. One moderation id cannot be reused
    // to re-debit only the images that succeeded.
    if (!current || producedCount > 0) return response;
    const refund = await refundGenerationDebit(current);
    return withRefundFlag(response, refund);
  }

  const withDebit = (base: { sourceType: string; detailKey?: string }): Prisma.InputJsonValue => {
    const current = hold;
    if (!current) return base;
    return {
      ...base,
      creemDebit: { accountId: current.accountId, transactionId: current.transactionId },
    };
  };

  // Verify project ownership
  const project = await db.imageProject.findUnique({
    where: { id: imageProjectId },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
  if (detailType && TYPE_TEMPLATES[detailType]) {
    const tpl = TYPE_TEMPLATES[detailType];
    prompt = [prompt, tpl.composition, tpl.lighting, tpl.camera, tpl.mood, tpl.technical].filter(Boolean).join(". ");
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

  const modelVersion = ENGINE_MODELS[actualEngine] || ENGINE_MODELS.flux;

  // Resolve provider — fallback to flux for Gemini-based engines when unavailable
  let provider;
  try {
    provider = getProvider(engineType);
  } catch {
    if (FALLBACK_ENGINES.has(engineType)) {
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

  const onAsyncPath = ASYNC_ENGINES.has(engineType) && actualEngine !== "flux";
  const imageCount = onAsyncPath
    ? 1
    : (typeof numOutputs === "number" && Number.isFinite(numOutputs) ? Math.ceil(numOutputs) : 2);
  const blockedSpend = await charge(imageCount);
  if (blockedSpend) return blockedSpend;

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
  if (ASYNC_ENGINES.has(engineType) && actualEngine !== "flux") {
    // Store generation params on task so /api/tasks/[id] can pick them up
    const debit = debitSnapshot(hold);
    await db.task.update({
      where: { id: task.id },
      data: {
        status: "PENDING",
        // Prompt payload only. The debit handle is generationMeta, which the
        // task poll must not clear when it nulls errorMessage.
        errorMessage: JSON.stringify({
          engineType: actualEngine,
          prompt,
          sharedImageUrl,
          genWidth,
          genHeight,
        }),
        ...(debit ? { generationMeta: { creemDebit: debit } } : {}),
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
          generationMeta: withDebit({ sourceType: "main" }),
        },
      });

      producedCount += 1;
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
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.task.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          errorMessage: message,
        },
      });
      await releaseGeneratingProject(imageProjectId, message);
      return fail(NextResponse.json(
        { error: "generation_failed", message },
        { status: 500 }
      ));
    }
  }

  // ── Bria path: product-preserving background swap ──
  // bria/generate-background takes image_url (product) + bg_prompt (background only).
  // It preserves the product automatically, so we must NOT pass referenceImageUrl,
  // modelVersion, width, or height — bria ignores them and they can confuse the API.
  // The prompt here is already a pure background description (see style-picker: bria
  // reuses promptFlux with the "keep the product identical" clause stripped).
  //
  // bria is a backup engine — it only fits the "swap background on a real product
  // photo" flow. Redirect to flux (the primary engine) when the request is outside
  // bria's lane, so the user still gets a result instead of an error:
  //   1. No product image (pure text-to-image) — bria needs image_url.
  //   2. White-bg / composite detailTypes (selling_points, material, size, craft,
  //      compare, multi_angle, color_variants, flatlay, brand_story, gift_accessory,
  //      detail) — these are clean studio composites, not background swaps. bria only
  //      fits the scene types: lifestyle / scene_atmosphere / in_use.
  if (actualEngine === "bria") {
    const briaUnsupportedDetail = !!detailType && !BRIA_SCENE_TYPES.has(detailType);
    if (!sharedImageUrl || briaUnsupportedDetail) {
      const reason = !sharedImageUrl ? "no product image" : `unsupported detailType "${detailType}"`;
      console.warn(`bria fallback to flux: ${reason}`);
      try {
        provider = getProvider("flux");
        actualEngine = "flux";
      } catch {
        return fail(NextResponse.json(
          { error: "No AI engine available" },
          { status: 400 }
        ));
      }
    }
  }

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
            generationMeta: withDebit({ sourceType: "main" }),
          },
        });

        // bria is async (Replicate) — poll until done.
        const imageResult = await pollPrediction(provider, prediction.predictionId);

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

          await postProcessImage(
            output.url,
            output.mimeType ?? "image/png",
            placeholder.id,
            brandPreset,
            spendTier,
          );
          generatedIds.push(placeholder.id);
          producedCount += 1;
        } else {
          await db.generatedImage.update({
            where: { id: placeholder.id },
            data: { status: "FAILED", errorMessage: "No output from provider" },
          });
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

      await db.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: "No output from provider" },
      });
      await releaseGeneratingProject(imageProjectId, "No output from provider");
      return fail(NextResponse.json(
        { error: "generation_failed", message: "No output from provider" },
        { status: 500 }
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: message },
      });
      await releaseGeneratingProject(imageProjectId, message);
      return fail(NextResponse.json(
        { error: "generation_failed", message },
        { status: 500 }
      ));
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
          generationMeta: withDebit({ sourceType: "main" }),
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
        imageResult = await pollPrediction(provider, prediction.predictionId);
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

        await postProcessImage(
          output.url,
          output.mimeType ?? "image/png",
          placeholder.id,
          brandPreset,
          spendTier,
        );
        generatedIds.push(placeholder.id);
        producedCount += 1;
      } else {
        await db.generatedImage.update({
          where: { id: placeholder.id },
          data: { status: "FAILED", errorMessage: "No output from provider" },
        });
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

    // All generations failed — do not leave the project in GENERATING.
    await db.task.update({
      where: { id: task.id },
      data: { status: "FAILED", errorMessage: "No output from provider" },
    });
    await releaseGeneratingProject(imageProjectId, "No output from provider");
    return fail(NextResponse.json(
      { error: "generation_failed", message: "No output from provider" },
      { status: 500 }
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db.task.update({
      where: { id: task.id },
      data: { status: "FAILED", errorMessage: message },
    });
    await releaseGeneratingProject(imageProjectId, message);
    return fail(NextResponse.json(
      { error: "generation_failed", message },
      { status: 500 }
    ));
  }
}
