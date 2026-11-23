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

/** Keep a stored-object content type from injecting header breaks. */
export function safeImageContentType(value: string | null | undefined): string {
  const type = (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "image/png" || type === "image/jpeg" || type === "image/webp" || type === "image/gif") return type;
  return "image/png";
}

/**
 * Response for a stored image. The body is the object stream, not a second
 * copy wrapped in NextResponse. Content-Length is set only when the store
 * reported a real size, so a short body is not advertised as a longer one.
 */
export function storedObjectResponse(input: {
  stream: ReadableStream<Uint8Array>;
  contentType?: string | null;
  contentLength?: number | null;
}): Response {
  const headers = new Headers({
    "Content-Type": safeImageContentType(input.contentType),
    "Cache-Control": "private, max-age=86400",
  });
  if (typeof input.contentLength === "number" && Number.isFinite(input.contentLength) && input.contentLength > 0) {
    headers.set("Content-Length", String(input.contentLength));
  }
  return new Response(input.stream, { status: 200, headers });
}
