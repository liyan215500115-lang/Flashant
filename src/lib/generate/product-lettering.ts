/**
 * Shots that show the product itself must keep its own brand lettering.
 * A blanket ban on every letter makes the model erase that original text.
 * Info shots overlay spec copy on the server. These shots must not paint it.
 */
export const PRESERVE_PRODUCT_LETTERING =
  "Keep the product's existing brand name, logo, and printed lettering exactly as they appear on the product. Do not remove, erase, redraw, or replace that original lettering. Do not add new words, captions, slogans, callouts, numbers, or marketing copy.";

/** The old guard. Product-showing and info-shot prompts must not include this phrase. */
export const BLANKET_TEXT_BAN = "do NOT render any text, words, letters, labels";

/** Pack shots in which the product itself is visible. Info shots are separate. */
const PRODUCT_SHOWING_SHOTS = new Set([
  "lifestyle",
  "scene_atmosphere",
  "in_use",
  "detail",
  "multi_angle",
  "flatlay",
  "color_variants",
  "brand_story",
  "gift_accessory",
]);

export function shotPreservesProductLettering(detailKey: string): boolean {
  return PRODUCT_SHOWING_SHOTS.has(detailKey);
}
