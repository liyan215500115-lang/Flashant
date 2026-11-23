/** Object keys we uploaded. Provider URLs and failure sentinels are not our files. */
export function isOwnedStorageKey(s3Key: string | null | undefined): boolean {
  if (!s3Key) return false;
  const key = s3Key.trim();
  if (!key || key === "failed" || key === "pending") return false;
  if (/^https?:\/\//i.test(key)) return false;
  return true;
}

/** Same-origin bytes for a generated image. The browser never follows a provider URL. */
export function generatedImageFilePath(id: string): string {
  return `/api/generated-images/${encodeURIComponent(id)}/file`;
}
