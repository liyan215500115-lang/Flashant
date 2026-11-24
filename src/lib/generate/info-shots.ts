/** White-background shots whose spec text is drawn after generation. */
export const INFO_SHOT_TYPES = ["selling_points", "material", "size", "craft", "compare"] as const;

const INFO_SHOT_TYPE_SET = new Set<string>(INFO_SHOT_TYPES);

/**
 * Empty-prompt fallback from the studio page: `Product in ${style} style`.
 * That sentence describes a look. It is not selling-point or spec copy.
 */
const STYLE_BOILERPLATE_CAPTION = /^Product in\s+.+?\s+style\.?$/i;

export function isInfoShot(key: string): boolean {
  return INFO_SHOT_TYPE_SET.has(key);
}

export function isStyleBoilerplateCaption(text: string): boolean {
  return STYLE_BOILERPLATE_CAPTION.test(text.trim());
}

/** Caption text to draw on an info shot. Style boilerplate is dropped. */
export function captionSpecText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || isStyleBoilerplateCaption(trimmed)) return "";
  return trimmed;
}
