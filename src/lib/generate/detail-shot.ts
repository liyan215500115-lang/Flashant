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
