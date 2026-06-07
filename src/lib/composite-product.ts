import "server-only";
import sharp from "sharp";

export async function compositeFromUrls(
  productUrl: string,
  backgroundUrl: string,
  options?: { canvasSize?: number; productScale?: number }
): Promise<Buffer> {
  const size = options?.canvasSize ?? 1024;
  const scale = options?.productScale ?? 0.65;

  const [productRes, bgRes] = await Promise.all([fetch(productUrl), fetch(backgroundUrl)]);
  if (!productRes.ok) throw new Error(`Product fetch failed: ${productRes.status}`);
  if (!bgRes.ok) throw new Error(`Background fetch failed: ${bgRes.status}`);

  const productBuf = Buffer.from(await productRes.arrayBuffer());
  const bgBuf = Buffer.from(await bgRes.arrayBuffer());

  const bg = await sharp(bgBuf).resize(size, size, { fit: "cover" }).toBuffer();
  const meta = await sharp(productBuf).metadata();
  const maxDim = size * scale;
  const ratio = Math.min(maxDim / (meta.width || 500), maxDim / (meta.height || 500));
  const pw = Math.round((meta.width || 500) * ratio);
  const ph = Math.round((meta.height || 500) * ratio);

  return sharp(bg)
    .composite([{
      input: await sharp(productBuf).resize(pw, ph).png().toBuffer(),
      top: Math.round((size - ph) / 2),
      left: Math.round((size - pw) / 2),
    }])
    .png()
    .toBuffer();
}
