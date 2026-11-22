import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { releaseGeneratingProject } from "@/lib/project-status";

// Hobby Fluid Compute default and maximum are both 300 seconds.
// Pro can be configured up to 800. This project is on Hobby, so do not exceed 300.
export const maxDuration = 300;
import { PLATFORM_SPECS } from "@/lib/platform-specs";
import { getSignedGetUrl } from "@/lib/s3";
import { overlayLogo, fetchImageBuffer } from "@/lib/overlay-logo";
import { uploadBuffer, hasS3Config } from "@/lib/s3";
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
    composition: "Product centered on pure white infinity background, filling 85% of frame, generous empty space around product for text overlay",
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
 * Pick the best engine for a detail type. Returns the provider and engine name.
 * GPT Image 2 excels at text rendering and clean layouts.
 * FLUX excels at img2img scene generation and model consistency.
 */
function getEngineForDetailType(detailKey: string): { provider: ReturnType<typeof getProvider>; engine: string } {
  if (GPT_IMAGE_TYPES.has(detailKey)) {
    try { return { provider: getProvider("openai"), engine: "openai" }; } catch {}
  }
  // Default: use FLUX for everything else
  return { provider: getProvider("flux"), engine: "flux" };
}

// Model version mapping for engines routed through Replicate.
// bria is intentionally absent: its provider hardcodes the version internally.
const ENGINE_MODELS: Record<string, string> = {
  flux: "black-forest-labs/flux-2-pro",
  sdxl: "stability-ai/sdxl",
  playground: "playgroundai/playground-v2.5-1024px-aesthetic",
};

/**
 * Re-upload a generated image to R2 (so it doesn't expire) and optionally apply a
 * brand logo overlay for non-FREE users. Returns the final URL and updates the
 * generatedImage DB record in place.
 */
async function postProcessImage(
  imageUrl: string,
  mimeType: string,
  generatedImageId: string,
  brandPreset: { logoUrl?: string | null } | null,
  quotaTier: string,
): Promise<string> {
  let finalUrl = imageUrl;

  // Re-upload to R2 so the image doesn't expire with the provider
  if (hasS3Config()) {
    try {
      const imageBuf = await fetchImageBuffer(imageUrl);
      const { publicUrl: newUrl, s3Key: newKey } = await uploadBuffer(
        imageBuf,
        mimeType || "image/png",
        "generated/",
      );
      finalUrl = newUrl;
      await db.generatedImage.update({
        where: { id: generatedImageId },
        data: { url: newUrl, s3Key: newKey },
      });
    } catch { /* keep provider URL as fallback */ }
  }

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
    "Keep any person visually identical to the reference image — same face, same body, same clothing.",
    BEAUTY_PERSON_CLOSEUP_PROMPT,
    PRODUCT_MACRO_LOCK,
    STYLE_LOCK_SAME_PRODUCT,
    MULTI_ANGLE_DISTINCT_VIEWS,
    NO_SOURCE_WATERMARK,
  );
  return fragments;
}

type DetailShotInput = { key?: unknown; prompt?: unknown };

function detailShotList(value: unknown): Array<{ key: string; prompt: string }> {
  if (!Array.isArray(value)) return [];
  const shots: Array<{ key: string; prompt: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as DetailShotInput;
    if (typeof record.key !== "string" || !record.key.trim()) continue;
    shots.push({
      key: record.key.trim(),
      prompt: typeof record.prompt === "string" ? record.prompt : "",
    });
  }
  return shots;
}

function assemblePackPrompt(
  dt: { key: string; prompt: string },
  plan: PackShotPlan,
  input: { baseStyle?: string; referenceImageUrl?: string; category?: string },
): string {
  const styleLocked = packStyleLocked(input);
  if (plan.promptOverride) {
    return applyPackPromptGuards(plan.promptOverride, { detailKey: dt.key, styleLocked });
  }
  const userPrompt = dt.prompt && dt.prompt !== dt.key ? dt.prompt : "";
  const tpl = TYPE_TEMPLATES[dt.key];
  const catProfile = input.category ? CATEGORY_PROFILES[input.category] : null;
  const categoryHint = !plan.omitCategoryHint && catProfile?.compositionHint
    ? ` ${catProfile.compositionHint}.`
    : "";
  const wantsTextOnImage = /(write|text|label|overlay|render.*word|render.*text|add.*text|写|字|标注|文字|打上|印上|加上字|显示文字)/i.test(userPrompt);
  const styleHint = input.baseStyle && !wantsTextOnImage
    ? ` Keep the same overall style, material, and color: ${input.baseStyle}.`
    : "";
  const identityLock = input.referenceImageUrl && !wantsTextOnImage && plan.mode !== "product_macro" && dt.key !== "multi_angle"
    ? " Keep any person visually identical to the reference image — same face, same body, same clothing."
    : "";
  const noTextGuard = wantsTextOnImage
    ? ""
    : " CRITICAL: do NOT render any text, words, letters, labels, numbers, or writing on the image.";
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
  return applyPackPromptGuards(withMacro, { detailKey: dt.key, styleLocked });
}

/**
 * One moderation id and one 1-credit debit per pack shot.
 * The debit is taken when that shot starts, not for the whole pack up front.
 * A failed shot is stored as FAILED and only that shot's debit is reversed.
 * A shot that has not started is not labeled prediction_timeout and is not debited.
 * A started shot keeps polling until the pack budget, not a shorter per-shot cap.
 * If the provider returns an image after that budget, that image is stored
 * and its debit is kept.
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
    if (blocked) return blocked;
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
      return NextResponse.json({ error: "No AI engine available" }, { status: 400 });
    }
  }

  const generationId = crypto.randomUUID();

  await db.imageProject.update({
    where: { id: input.imageProjectId },
    data: { status: "GENERATING", title: input.projectTitle || undefined },
  });

  const now = input.now ?? Date.now;
  // Close out before the Hobby 300s kill. Shots that never start are not timeouts.
  const packDeadline = now() + PACK_BUDGET_MS;

  type Attempt = {
    key: string;
    prompt: string;
    engine: string;
    hold: DebitHold | null;
    predictionId?: string;
    outputs?: Array<{ url: string }>;
    error?: string;
  };

  const generated: Array<{ key: string; url: string; label: string }> = [];
  const failed: Array<{ key: string; reason: string; creditsRefunded: boolean; charged: boolean }> = [];
  let creditsRefunded = 0;
  let creditsCharged = 0;
  /** Debits taken for a shot that is not stored yet. Cleared on store or refund. */
  const unsettled = new Map<string, DebitHold>();

  function trackHold(hold: DebitHold | null) {
    if (hold) unsettled.set(hold.transactionId, hold);
  }

  function forgetHold(hold: DebitHold | null) {
    if (hold) unsettled.delete(hold.transactionId);
  }

  function planShot(shot: { key: string; prompt: string }) {
    const plan = planPackShot({
      detailKey: shot.key,
      category: input.category,
      productImageUrl: sharedImageUrl,
      referenceImageUrl: input.referenceImageUrl,
      referenceHasPerson: input.referenceHasPerson,
      contextText: [input.baseStyle, shot.prompt].filter(Boolean).join("\n"),
    });
    const { engine } = getEngineForDetailType(shot.key);
    return { plan, prompt: assemblePackPrompt(shot, plan, input), engine };
  }

  async function settleFailure(attempt: Attempt, reason: string) {
    const charged = Boolean(attempt.hold);
    const refunded = attempt.hold ? (await refundGenerationDebit(attempt.hold)).reversed : false;
    forgetHold(attempt.hold);
    if (refunded) creditsRefunded += 1;
    const message = reason.slice(0, 500) || "generation_failed";
    try {
      await db.generatedImage.create({
        data: {
          imageProjectId: input.imageProjectId,
          productImageId: input.productImageId,
          s3Key: "failed",
          url: "",
          promptUsed: attempt.prompt,
          aiProvider: attempt.engine,
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
          generationMeta: {
            sourceType: "detail",
            detailKey: attempt.key,
            ...(attempt.hold
              ? { creemDebit: { accountId: attempt.hold.accountId, transactionId: attempt.hold.transactionId } }
              : {}),
            ...(refunded ? { creditsRefunded: true } : {}),
          },
        },
      });
      await db.task.create({
        data: {
          imageProjectId: input.imageProjectId,
          productImageId: input.productImageId,
          engineType: attempt.engine,
          status: "FAILED",
          errorMessage: message,
          generationMeta: {
            sourceType: "detail",
            detailKey: attempt.key,
            ...(attempt.hold
              ? { creemDebit: { accountId: attempt.hold.accountId, transactionId: attempt.hold.transactionId } }
              : {}),
          },
        },
      });
    } catch (error) {
      console.error("Failed to persist pack failure", error);
    }
    failed.push({ key: attempt.key, reason: message, creditsRefunded: refunded, charged });
  }

  async function storeSuccess(attempt: Attempt, url: string) {
    await db.generatedImage.create({
      data: {
        imageProjectId: input.imageProjectId,
        productImageId: input.productImageId,
        s3Key: url,
        url,
        promptUsed: attempt.prompt,
        aiProvider: attempt.engine,
        status: "SUCCEEDED",
        completedAt: new Date(),
        generationMeta: {
          sourceType: "detail",
          detailKey: attempt.key,
          ...(attempt.hold
            ? { creemDebit: { accountId: attempt.hold.accountId, transactionId: attempt.hold.transactionId } }
            : {}),
        },
      },
    });
    forgetHold(attempt.hold);
    generated.push({ key: attempt.key, url, label: attempt.key });
    if (attempt.hold) creditsCharged += 1;
    try {
      await db.task.create({
        data: {
          imageProjectId: input.imageProjectId,
          productImageId: input.productImageId,
          engineType: attempt.engine,
          status: "SUCCEEDED",
          resultUrl: url,
          predictionId: attempt.predictionId,
          generationMeta: {
            sourceType: "detail",
            detailKey: attempt.key,
            ...(attempt.hold
              ? { creemDebit: { accountId: attempt.hold.accountId, transactionId: attempt.hold.transactionId } }
              : {}),
          },
        },
      });
    } catch (error) {
      console.error("Failed to persist pack task", error);
    }
  }

  let chargeBlocked: NextResponse | null = null;

  try {
    for (let index = 0; index < shots.length; index += 1) {
      const shot = shots[index];
      const planned = planShot(shot);
      const baseAttempt = {
        key: shot.key,
        prompt: planned.prompt,
        engine: planned.engine,
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
              engine: restPlan.engine,
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
        const { provider } = getEngineForDetailType(shot.key);
        const prediction = await provider.createPrediction({
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

      let result;
      try {
        const provider = attempt.engine === "openai" ? getProvider("flux") : getProvider(attempt.engine);
        // An already-debited shot uses the whole pack budget. PER_SHOT_WAIT_MS only
        // decides whether the next shot is worth starting.
        const shotDeadline = packDeadline;
        result = await provider.getPrediction(attempt.predictionId);
        while (result.status === "processing" && now() < shotDeadline) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          result = await provider.getPrediction(attempt.predictionId);
        }
        // One read after the pack budget. Store a late image before any refund.
        if (result.status === "processing" && !result.outputs?.[0]?.url) {
          try {
            const late = await provider.getPrediction(attempt.predictionId);
            if (late.outputs?.[0]?.url || late.status === "failed" || late.error) {
              result = late;
            }
          } catch (error) {
            console.error("Pack late prediction read failed", error);
          }
        }
      } catch (error) {
        await settleFailure(attempt, error instanceof Error ? error.message : "prediction_failed");
        continue;
      }

      const url = result.outputs?.[0]?.url || "";
      if (url) {
        try {
          await storeSuccess(attempt, url);
        } catch (error) {
          await settleFailure(attempt, error instanceof Error ? error.message : "result_not_stored");
        }
      } else {
        const reason = result.error
          || (result.status === "processing" ? "prediction_timeout" : "no_output");
        await settleFailure(attempt, reason);
      }
    }
  } finally {
    for (const hold of unsettled.values()) {
      const refunded = (await refundGenerationDebit(hold)).reversed;
      if (refunded) creditsRefunded += 1;
    }
    unsettled.clear();
  }

  // Same close-out for a blocked first debit and for a pack that produced nothing.
  // Otherwise the early 402 leaves the project on GENERATING.
  const pendingCount = await db.task.count({
    where: { imageProjectId: input.imageProjectId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (pendingCount === 0) {
    await db.imageProject.update({
      where: { id: input.imageProjectId },
      data: generated.length > 0
        ? { status: "GENERATED", errorMessage: null }
        : { status: "FAILED", errorMessage: failed[0]?.reason || "All predictions failed" },
    });
  }

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
      creditsNotCharged: failed.filter((shot) => !shot.charged).length,
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
    creditsNotCharged: failed.filter((shot) => !shot.charged).length,
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
