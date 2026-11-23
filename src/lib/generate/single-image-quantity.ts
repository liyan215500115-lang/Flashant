/** Images one single-image generation run may request. Pack runs do not use this cap. */
export const SINGLE_IMAGE_RUN_MAX = 8;

/**
 * True when a single-image `numOutputs` would generate more than the per-run cap.
 * Missing or non-numeric values are left to the route's existing default.
 */
export function singleImageRunExceedsCap(raw: unknown): boolean {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
  return Math.ceil(raw) > SINGLE_IMAGE_RUN_MAX;
}
