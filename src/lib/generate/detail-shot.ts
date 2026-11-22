/**
 * How a pack shot is sent to the model.
 * Every shot type keeps the original product photo as `productImageUrl`.
 * A previous generated image or a person is only `referenceImageUrl`.
 * A face / smear-on-skin prompt is only for beauty, and only when the
 * reference actually contains a person.
 */

export const BEAUTY_PERSON_CLOSEUP_PROMPT =
  "Extreme close-up of the person from the reference image using or wearing the product. Focus on the face/head/hands where the product is being applied or worn. The product itself should be visible in use (on skin, on head, on body) but do NOT show any product packaging, bottles, boxes, or containers. Keep the person visually IDENTICAL to the reference image — same face, same features, same skin tone. Soft diffused lighting, 100mm macro lens f/2.8, very shallow depth of field, editorial quality. CRITICAL: do NOT render any text or labels on the image.";

export const PRODUCT_MACRO_LOCK =
  "Macro photograph of this exact product's material and structure. The product must stay clearly recognizable: same shape, color, hardware, and construction. Do not replace it with a face, skincare smear, cream on skin, or a different object.";

/** Appended to every shot while style-lock is on. Angle may change; the product may not. */
export const STYLE_LOCK_SAME_PRODUCT =
  "Style lock: every shot must keep this exact product, the same material, the same color, and the same overall style. Do not drift into a different item or a different look. Camera angle and framing may change; the product itself may not.";

/**
 * One multi-angle frame must show real viewpoint changes.
 * A 2x2 grid of nearly matching three-quarter shots collapses into a symmetrical still life.
 */
export const MULTI_ANGLE_DISTINCT_VIEWS =
  "Show distinguishable views of this same product: a true front, a true side near 90 degrees, and a back or opposite side. For earrings, a left-ear view and a right-ear view are allowed only when the camera angle still changes. Do not produce a nearly symmetrical still life, a mirrored duplicate, or the same front-facing angle twice.";

/** Generator marks, and watermarks already printed on the source photo, must not appear in the result. */
export const NO_SOURCE_WATERMARK =
  "Do not add a watermark, signature, or corner badge, and do not write AI生成 or 即梦AI. If the original product photo or the reference image contains a watermark or corner mark, do not reproduce it.";

export function packStyleLocked(input: {
  baseStyle?: string | null;
  referenceImageUrl?: string | null;
}): boolean {
  return Boolean(input.baseStyle?.trim() || input.referenceImageUrl?.trim());
}

export function applyPackPromptGuards(
  prompt: string,
  input: { detailKey: string; styleLocked: boolean },
): string {
  const parts = [prompt.trim()];
  if (input.styleLocked) parts.push(STYLE_LOCK_SAME_PRODUCT);
  if (input.detailKey === "multi_angle" && !prompt.includes(MULTI_ANGLE_DISTINCT_VIEWS)) {
    parts.push(MULTI_ANGLE_DISTINCT_VIEWS);
  }
  if (!prompt.includes(NO_SOURCE_WATERMARK)) parts.push(NO_SOURCE_WATERMARK);
  return parts.filter(Boolean).join(" ");
}

const PERSON_SIGNAL =
  /person|people|model|face|facial|\bhands?\b|skin|wearing|worn|applying|smear|模特|人物|人脸|面部|手部|皮肤|佩戴|穿着|涂抹|上脸/i;

export function referenceContainsPerson(
  parts: Array<string | null | undefined>,
  explicit?: boolean,
): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  return parts.some((part) => typeof part === "string" && PERSON_SIGNAL.test(part));
}

export type PackShotMode = "product_macro" | "beauty_person_closeup" | "scene_reference" | "standard";

export interface PackShotPlan {
  mode: PackShotMode;
  /** Img2img subject. Always the original product photo, for every shot type. */
  productImageUrl: string;
  referenceImageUrl?: string;
  /** Replaces the assembled detail prompt. Only the beauty person close-up. */
  promptOverride?: string;
  /** Category scene hints fight a product macro, so they are omitted. */
  omitCategoryHint: boolean;
}

const SCENE_TYPES = new Set(["lifestyle", "scene_atmosphere", "in_use"]);

export function planPackShot(input: {
  detailKey: string;
  category?: string | null;
  productImageUrl: string;
  referenceImageUrl?: string | null;
  referenceHasPerson?: boolean;
  contextText?: string | null;
}): PackShotPlan {
  const productImageUrl = input.productImageUrl;
  const reference = input.referenceImageUrl?.trim() || undefined;
  const person = Boolean(reference) && referenceContainsPerson(
    [input.contextText],
    input.referenceHasPerson,
  );

  if (input.detailKey === "detail") {
    if (input.category === "beauty" && person) {
      return {
        mode: "beauty_person_closeup",
        productImageUrl,
        referenceImageUrl: reference,
        promptOverride: BEAUTY_PERSON_CLOSEUP_PROMPT,
        omitCategoryHint: false,
      };
    }
    return {
      mode: "product_macro",
      productImageUrl,
      referenceImageUrl: undefined,
      omitCategoryHint: true,
    };
  }

  if (SCENE_TYPES.has(input.detailKey) && reference) {
    return {
      mode: "scene_reference",
      productImageUrl,
      referenceImageUrl: reference,
      omitCategoryHint: false,
    };
  }

  return {
    mode: "standard",
    productImageUrl,
    referenceImageUrl: reference,
    omitCategoryHint: false,
  };
}
