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

function isInk(data: Buffer, width: number, channels: number, x: number, y: number) {
  const [r, g, b] = pixel(data, width, channels, x, y);
  return r < 80 && g < 80 && b < 80;
}

/** Dark pixels, plus how many sit in the interior of the ink bounds rather than on a hollow frame. */
function inkStats(data: Buffer, width: number, height: number, channels: number) {
  let dark = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isInk(data, width, channels, x, y)) continue;
      dark += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  let center = 0;
  if (maxX >= 0) {
    const insetX = Math.max(1, Math.round((maxX - minX + 1) * 0.2));
    const insetY = Math.max(1, Math.round((maxY - minY + 1) * 0.2));
    for (let y = minY + insetY; y <= maxY - insetY; y += 1) {
      for (let x = minX + insetX; x <= maxX - insetX; x += 1) {
        if (isInk(data, width, channels, x, y)) center += 1;
      }
    }
  }
  return { dark, center };
}

async function renderCaption(text: string) {
  const source = await whiteWithProduct(280, 200, { top: 10, left: 90, width: 100, height: 60 });
  const output = await compositeSpecCaption(source, text);
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
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

  it("draws distinct Chinese and English glyphs instead of identical .notdef boxes", async () => {
    const rendered = await Promise.all(
      ["核", "心", "A", "B", "8", "0"].map(async (text) => ({ text, ...(await renderCaption(text)) })),
    );
    const by = Object.fromEntries(rendered.map((item) => [item.text, item]));

    for (const text of ["核", "心", "A", "B", "8"]) {
      const stats = inkStats(by[text].data, by[text].info.width, by[text].info.height, by[text].info.channels);
      expect(stats.dark, text).toBeGreaterThan(40);
      // A hollow .notdef box has an empty center. Real strokes do not.
      expect(stats.center, text).toBeGreaterThan(0);
    }

    expect(by["A"].data.equals(by["B"].data)).toBe(false);
    expect(by["核"].data.equals(by["心"].data)).toBe(false);
    expect(by["8"].data.equals(by["0"].data)).toBe(false);
    expect(by["A"].data.equals(by["核"].data)).toBe(false);
  });

  it("draws an English caption in the margin without covering the product", async () => {
    const source = await whiteWithProduct(240, 240, { top: 16, left: 70, width: 100, height: 70 });
    const output = await compositeSpecCaption(source, "Battery life");
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const product = pixel(data, info.width, info.channels, 100, 40);
    expect(product[0]).toBeGreaterThan(180);
    expect(product[1]).toBeLessThan(80);
    expect(product[2]).toBeLessThan(80);

    const stats = inkStats(data, info.width, info.height, info.channels);
    expect(stats.dark).toBeGreaterThan(80);
    expect(stats.center).toBeGreaterThan(0);

    let darkOnProduct = 0;
    for (let y = 16; y < 16 + 70; y += 1) {
      for (let x = 70; x < 170; x += 1) {
        if (isInk(data, info.width, info.channels, x, y)) darkOnProduct += 1;
      }
    }
    expect(darkOnProduct).toBe(0);
  });

  it("does not paint a missing glyph as a hollow box", async () => {
    const source = await whiteWithProduct(180, 180, { top: 20, left: 40, width: 80, height: 50 });
    await expect(compositeSpecCaption(source, "\uE000")).rejects.toThrow("caption_glyphs_missing");
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
