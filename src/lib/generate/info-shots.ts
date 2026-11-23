/** White-background shots whose spec text is drawn after generation. */
export const INFO_SHOT_TYPES = ["selling_points", "material", "size", "craft", "compare"] as const;

const INFO_SHOT_TYPE_SET = new Set<string>(INFO_SHOT_TYPES);

export function isInfoShot(key: string): boolean {
  return INFO_SHOT_TYPE_SET.has(key);
}
