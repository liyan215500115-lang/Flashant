import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { captionFontSize, compositeSpecCaption } from "@/lib/spec-caption";

async function whiteWithProduct(width: number, height: number, product: { top: number; left: number; width: number; height: number }) {
  const swatch = await sharp({
    create: {
      width: product.width,
      height: product.height,
      channels: 3,
      background: { r: 220, g: 30, b: 40 },
    },
  }).png().toBuffer();
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).composite([{ input: swatch, top: product.top, left: product.left }]).png().toBuffer();
}

function pixel(data: Buffer, width: number, channels: number, x: number, y: number) {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]] as const;
}

describe("spec caption overlay", () => {
  it("keeps a readable size instead of shrinking the caption", () => {
    expect(captionFontSize(1024)).toBeGreaterThanOrEqual(32);
    expect(captionFontSize(80)).toBe(32);
  });

  it("draws the caption in the white margin and leaves the product pixels unchanged", async () => {
    const source = await whiteWithProduct(240, 240, { top: 16, left: 70, width: 100, height: 70 });
    const output = await compositeSpecCaption(source, "温和保湿");
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const product = pixel(data, info.width, info.channels, 100, 40);
    expect(product[0]).toBeGreaterThan(180);
    expect(product[1]).toBeLessThan(80);
    expect(product[2]).toBeLessThan(80);

    let darkBelow = 0;
    const startY = 16 + 70;
    for (let y = startY; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const [r, g, b] = pixel(data, info.width, info.channels, x, y);
        if (r < 60 && g < 60 && b < 60) darkBelow += 1;
      }
    }
    expect(darkBelow).toBeGreaterThan(20);

    let darkOnProduct = 0;
    for (let y = 16; y < 16 + 70; y += 1) {
      for (let x = 70; x < 170; x += 1) {
        const [r, g, b] = pixel(data, info.width, info.channels, x, y);
        if (r < 60 && g < 60 && b < 60) darkOnProduct += 1;
      }
    }
    expect(darkOnProduct).toBe(0);
  });

  it("extends the canvas instead of covering a product that already fills the frame", async () => {
    const source = await whiteWithProduct(180, 180, { top: 8, left: 20, width: 140, height: 164 });
    const output = await compositeSpecCaption(source, "温和保湿 长文案会自动换行而不是缩到看不清");
    const before = await sharp(source).metadata();
    const after = await sharp(output).metadata();
    expect(after.height).toBeGreaterThan(before.height ?? 0);
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const product = pixel(data, info.width, info.channels, 80, 40);
    expect(product[0]).toBeGreaterThan(180);
    expect(product[1]).toBeLessThan(80);
  });
});
