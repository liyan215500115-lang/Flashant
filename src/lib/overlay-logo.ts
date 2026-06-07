import "server-only";
import sharp from "sharp";

/**
 * Overlay a brand logo onto a generated product image.
 * Logo placed in top-left corner with 24px margin, 120px wide (keeps aspect ratio).
 * Returns a PNG buffer.
 */
export async function overlayLogo(
  imageBuffer: Buffer,
  logoBuffer: Buffer,
  options?: { logoWidth?: number; margin?: number }
): Promise<Buffer> {
  const logoWidth = options?.logoWidth ?? 120;
  const margin = options?.margin ?? 24;

  // Resize logo to target width, maintaining aspect ratio
  const resizedLogo = await sharp(logoBuffer)
    .resize({ width: logoWidth, withoutEnlargement: true })
    .ensureAlpha(0.6) // 60% opacity for subtle watermark feel
    .png()
    .toBuffer();

  // Get resized logo dimensions
  const logoMeta = await sharp(resizedLogo).metadata();

  // Composite logo onto image
  return sharp(imageBuffer)
    .composite([
      {
        input: resizedLogo,
        top: margin,
        left: margin,
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Fetch an image from a URL and return it as a Buffer.
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
