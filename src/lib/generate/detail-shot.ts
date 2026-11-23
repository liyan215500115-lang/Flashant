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

/** Appended to every shot while style-lock is on. Angle may change; the product and the model may not. */
export const STYLE_LOCK_SAME_PRODUCT =
  "Style lock: every shot must keep this exact product, the same material, the same color, and the same overall style. Do not drift into a different item or a different look. Camera angle and framing may change; the product itself may not. When a person appears, lock the model too: the same person, the same face, the same features, and the same skin tone. Do not cast a different model.";

/**
 * One multi-angle frame must show real viewpoint changes of one SKU.
 * Angle changes alone are not enough: every panel keeps the same outline,
 * frame, and hardware, and a back view must not invent unseen parts.
 */
export const MULTI_ANGLE_DISTINCT_VIEWS =
  "Every panel in this one image is the same SKU: the same outline, the same bezel or frame, and the same hardware structure. Do not morph, melt, or liquify the metal, and do not swap in a different frame. Show distinguishable views of this same product: a true front, a true side near 90 degrees, and a back or opposite side. A back view is the back of this same object. Do not add ports, connectors, cables, or other parts that are not visible in the source and present them as confirmed specifications. For earrings, the back view must show the finding: the ear post and the clutch (背扣), without changing the front bezel. For earrings, a left-ear view and a right-ear view are allowed only when the camera angle still changes and the SKU stays identical. Do not produce a nearly symmetrical still life, a mirrored duplicate, or the same front-facing angle twice.";

export const MULTI_ANGLE_CAMERA =
  "Move the camera between a front view, a side profile near 90 degrees, and a back or opposite-side view of this same object. A small turn is not an angle change. Keep the product the same size in each view. Do not invent a port, connector, or other hardware on the back. For earrings, the back view shows the ear post and clutch.";

/** Blocks a second colorway, a logo, or decorative light on a compare frame. */
export const COMPARE_ONLY_REAL_ATTRIBUTES =
  "Contrast only an attribute or function that is visible in the source image or stated in the copy. If the source has only one color, do not invent a second colorway. Do not paint a logo, brand name, or garbled lettering on the product. Do not add lighting effects, colored rims, under-glow, or indicator lights that are absent from the source. Do not change the product's appearance. Both sides stay this same product unless the copy states a real difference.";

export const COMPARE_NAMED_DIFFERENCES =
  "Contrast only the colors or functions actually named in the copy. Do not invent an extra colorway, a logo, brand name, garbled lettering, or a lighting effect that is not in the source. Do not change the product's shape or hardware.";

export const SELLING_POINTS_UNCHANGED_PRODUCT =
  "Photograph this exact product without changing its appearance. If the source image and the copy have no brand and no printed text, do not invent a logo, brand name, wordmark, or garbled lettering. Do not add decorative lighting, colored rims, under-glow, or indicator lights that are not in the source. Selling-point copy is overlaid later and must not be painted onto the product.";

export const SINGLE_COLOR_MERCHANDISING =
  "This SKU has only one color. Do not invent other colorways, metal tones, or a color board. Show this exact SKU only, in several merchandising displays: a clean white background, a material and texture close-up, and a flat lay. Lock the shape. Do not stretch, melt, or open the form into a C-shape or crescent.";

export const JEWELRY_SILHOUETTE_LOCK =
  "Jewelry must match the source silhouette exactly. Left and right must stay a matched pair. Do not melt, liquify, stretch, or open the form into a C-shape or crescent. Keep a closed bezel closed: a tight wavy bezel must not become an open, scalloped, or different frame.";

export const NO_INVENTED_ACCESSORIES =
  "Show only the product body and accessories that are actually visible in the source image or named in the copy. Do not invent scoops, sieve trays, charcoal packs, tools, cables, or inserts. Never render a non-electronic product with a charging cable, port, connector, or smart-hardware detail.";

export const NO_ELECTRONICS_ON_NONELECTRONIC =
  "This product is not electronic. Do not add a charging cable, port, connector, battery door, or smart-hardware detail that is not in the source.";

export const SOURCE_STRUCTURE_LOCK =
  "Do not add stickers, labels, tape, patches, or badges that are absent from the source photo. Keep structural proportions consistent with the source, including chimney or vent height, drawer size, and arch openings. Do not make a short part tall.";

export const NO_UNSEEN_STRUCTURE =
  "Do not depict structural parts that are not visible in the source photo, such as ports, connectors, cables, or a newly invented back mechanism, as if they were confirmed specifications.";

export const LIFESTYLE_DISTINCT_COMPOSITION =
  "A real usage setting, clearly different from a dramatic atmosphere hero shot. Show the product in a practical place where it would actually be used, with a different camera height, background, and placement. Do not repeat the atmosphere shot's angle, surface, or composition.";

export const ATMOSPHERE_DISTINCT_COMPOSITION =
  "Spatial mood, not a usage documentary. The product is a lone hero in a dramatic space with generous negative space and a camera position that is obviously different from the everyday usage shot. Do not repeat the usage shot's angle, rug, surface, or product placement.";

export const PORTRAIT_REFERENCE_LOCK =
  "Use the portrait reference for any person in this image: the same person, the same face, the same features, and the same skin tone. Do not substitute a different model.";

/** Generator marks, and watermarks already printed on the source photo, must not appear in the result. */
export const NO_SOURCE_WATERMARK =
  "Do not add a watermark, signature, or corner badge, and do not write AI生成 or 即梦AI. If the original product photo or the reference image contains a watermark or corner mark, do not reproduce it.";

const COLOR_GROUPS: Array<{ id: string; terms: string[] }> = [
  { id: "rose", terms: ["rose gold", "rose-gold", "玫瑰金"] },
  { id: "gold", terms: ["gold", "golden", "金色", "黄金"] },
  { id: "silver", terms: ["silver", "银色"] },
  { id: "black", terms: ["black", "黑色"] },
  { id: "white", terms: ["white", "白色"] },
  { id: "red", terms: ["red", "红色"] },
  { id: "blue", terms: ["blue", "蓝色"] },
  { id: "green", terms: ["green", "绿色"] },
  { id: "pink", terms: ["pink", "粉色", "粉红"] },
  { id: "yellow", terms: ["yellow", "黄色"] },
  { id: "brown", terms: ["brown", "棕色", "褐色"] },
  { id: "beige", terms: ["beige", "米色"] },
  { id: "purple", terms: ["purple", "紫色"] },
  { id: "orange", terms: ["orange", "橙色"] },
  { id: "gray", terms: ["gray", "grey", "灰色"] },
  { id: "copper", terms: ["copper", "铜色"] },
  { id: "platinum", terms: ["platinum", "铂金"] },
];

const JEWELRY_SIGNAL =
  /earring|earrings|jewelry|necklace|bracelet|bangle|brooch|pendant|anklet|耳饰|耳环|耳钉|耳坠|珠宝|首饰|项链|手链|手镯|戒指|吊坠/i;

const ELECTRONICS_SIGNAL =
  /earbud|earphone|headphone|bluetooth|usb|charger|charging|电子|耳机|充电|蓝牙|数码/i;

const OMIT_CATEGORY_HINT = new Set([
  "detail",
  "scene_atmosphere",
  "multi_angle",
  "color_variants",
  "selling_points",
  "compare",
  "material",
  "size",
  "craft",
]);

export function packStyleLocked(input: {
  baseStyle?: string | null;
  referenceImageUrl?: string | null;
}): boolean {
  return Boolean(input.baseStyle?.trim() || input.referenceImageUrl?.trim());
}

export function listedProductColors(copy: string): string[] {
  let text = copy.toLowerCase();
  text = text.replace(/white background|纯白背景|白色背景|白底/g, " ");
  const found: string[] = [];
  for (const group of COLOR_GROUPS) {
    if (!group.terms.some((term) => text.includes(term))) continue;
    found.push(group.id);
    for (const term of group.terms) text = text.split(term).join(" ");
  }
  return found;
}

/** Two or more distinct product colors in the copy. A generic word like "colors" does not count. */
export function copyListsMultipleColors(copy: string): boolean {
  return listedProductColors(copy).length >= 2;
}

export function mentionsJewelry(copy: string): boolean {
  return JEWELRY_SIGNAL.test(copy);
}

export function copyDescribesElectronics(category: string | null | undefined, copy: string): boolean {
  if (category === "electronics") return true;
  return ELECTRONICS_SIGNAL.test(copy);
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

export function packShotTemplatePatch(detailKey: string, copy: string): {
  composition?: string;
  lighting?: string;
  camera?: string;
  mood?: string;
} {
  if (detailKey === "color_variants" && !copyListsMultipleColors(copy)) {
    return {
      composition: SINGLE_COLOR_MERCHANDISING,
      lighting: "Soft even studio light and the same exposure in every display, so the one real color stays accurate.",
      camera: "Merchandising frames of this one SKU only: straight-on on white, a material close-up, and a flat lay. Do not build a color grid.",
      mood: "Same product, locked shape, no invented colorways.",
    };
  }
  if (detailKey === "compare") {
    return {
      composition: copyListsMultipleColors(copy) ? COMPARE_NAMED_DIFFERENCES : COMPARE_ONLY_REAL_ATTRIBUTES,
    };
  }
  return {};
}

export function extraPackInstructions(input: {
  detailKey: string;
  category?: string | null;
  copy?: string | null;
  lockPortrait?: boolean;
}): string[] {
  const copy = input.copy ?? "";
  const lines = [SOURCE_STRUCTURE_LOCK];
  if (input.detailKey === "multi_angle") lines.push(NO_UNSEEN_STRUCTURE);
  if (mentionsJewelry(copy)) lines.push(JEWELRY_SILHOUETTE_LOCK);
  if (input.detailKey === "brand_story" || input.detailKey === "gift_accessory") {
    lines.push(NO_INVENTED_ACCESSORIES);
  } else if (!copyDescribesElectronics(input.category, copy)) {
    lines.push(NO_ELECTRONICS_ON_NONELECTRONIC);
  }
  if (input.lockPortrait) lines.push(PORTRAIT_REFERENCE_LOCK);
  return lines;
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

/**
 * Shots that can show a person and therefore must receive the pack portrait
 * when style lock is on. Product-only frames stay off this list so a face
 * reference cannot pull them into a different scene.
 */
export function shotIncludesPerson(input: {
  detailKey: string;
  category?: string | null;
  contextText?: string | null;
}): boolean {
  if (input.detailKey === "detail" || input.detailKey === "multi_angle" || input.detailKey === "flatlay") {
    return false;
  }
  if (input.detailKey === "in_use") return true;
  if (input.category === "fashion" && (input.detailKey === "lifestyle" || input.detailKey === "color_variants")) {
    return true;
  }
  if (
    input.detailKey === "lifestyle"
    || input.detailKey === "scene_atmosphere"
    || input.detailKey === "color_variants"
  ) {
    return referenceContainsPerson([input.contextText]);
  }
  return false;
}

/** A shot that can establish the pack's face. color_variants consumes that face; it does not create it. */
export function isPortraitAnchor(detailKey: string): boolean {
  return detailKey === "in_use" || detailKey === "lifestyle" || detailKey === "scene_atmosphere";
}

export function omitPackCategoryHint(detailKey: string): boolean {
  return OMIT_CATEGORY_HINT.has(detailKey);
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
  /** Face from style lock or from an earlier people shot in this pack. */
  portraitImageUrl?: string | null;
  referenceHasPerson?: boolean;
  contextText?: string | null;
}): PackShotPlan {
  const productImageUrl = input.productImageUrl;
  const incoming = input.referenceImageUrl?.trim() || undefined;
  const portrait = input.portraitImageUrl?.trim() || undefined;
  const people = shotIncludesPerson({
    detailKey: input.detailKey,
    category: input.category,
    contextText: input.contextText,
  });
  const reference = people && portrait ? portrait : incoming;
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
      omitCategoryHint: omitPackCategoryHint(input.detailKey),
    };
  }

  return {
    mode: "standard",
    productImageUrl,
    referenceImageUrl: reference,
    omitCategoryHint: omitPackCategoryHint(input.detailKey),
  };
}
