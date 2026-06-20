import "server-only";

import sharp from "sharp";
import { uploadBuffer, hasS3Config, getSignedGetUrl } from "@/lib/s3";

/**
 * Download a product/reference image, downscale it to ≤1024px on the long edge,
 * and persist the compressed copy to R2. Returns a fresh signed URL.
 *
 * Why: Replicate's flux-2-pro bills per input megapixel ($0.015/MP). Users upload
 * full-resolution product photos (avg 3.35MP observed), and passing those straight
 * to Replicate costs ~$0.05/image in input fees alone. Downsizing to ~1MP cuts the
 * input cost ~70% with no perceptible quality loss (the model resizes internally
 * anyway). flux-kontext-pro is flat-rated so this doesn't change its cost, but the
 * smaller payload still speeds up the reference-image fetch.
 *
 * Falls back to the original URL when R2 is not configured or sharp fails — image
 * generation still works, just without the cost saving.
 */
export async function prepareReferenceImage(
  originalUrl: string,
  maxEdge = 1024
): Promise<string> {
  // Only http(s) URLs can be compressed; data: URLs and local paths pass through.
  if (!originalUrl.startsWith("http")) return originalUrl;

  try {
    const res = await fetch(originalUrl);
    if (!res.ok) return originalUrl;
    const originalBuf = Buffer.from(await res.arrayBuffer());

    const compressed = await sharp(originalBuf)
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    if (!hasS3Config()) {
      // No R2 — can't host a compressed copy, use the original.
      return originalUrl;
    }

    const r2 = await uploadBuffer(compressed, "image/png", "products-compressed/");
    return await getSignedGetUrl(r2.s3Key, 3600);
  } catch {
    // Compression or upload failed — fall back to original so generation still proceeds.
    return originalUrl;
  }
}
