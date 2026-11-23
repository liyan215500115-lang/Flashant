import { readFileSync } from "fs";
import path from "path";
import { parse as parseFont } from "opentype.js";
import sharp from "sharp";

/**
 * Droid Sans Fallback covers CJK but not Basic Latin, so ASCII letters and
 * digits would draw as its hollow .notdef boxes. Noto Sans supplies Latin,
 * digits, and common punctuation. Glyph 0 is .notdef in both fonts.
 */
const FONT_FILES = ["NotoSans-Regular.ttf", "DroidSansFallbackFull.ttf"] as const;

/** Readable on a 1024 canvas. Never reduced to squeeze a long caption onto one line. */
export function captionFontSize(imageWidth: number): number {
  const width = Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : 1024;
  return Math.max(32, Math.round(width / 26));
}

interface CaptionFont {
  getPath(text: string, x: number, y: number, fontSize: number): { toPathData(decimalPlaces?: number): string };
  getAdvanceWidth(text: string, fontSize: number): number;
  charToGlyph(text: string): { index: number };
}

interface ShapedGlyph {
  ch: string;
  font: CaptionFont | null;
  width: number;
}

let fontCache: CaptionFont[] | null = null;

function captionFonts(): CaptionFont[] {
  if (fontCache) return fontCache;
  fontCache = FONT_FILES.map((file) => {
    const fontPath = path.join(process.cwd(), "assets", "fonts", file);
    return parseFont(readFileSync(fontPath));
  });
  return fontCache;
}

function shapeText(text: string, fontSize: number): ShapedGlyph[] {
  const fonts = captionFonts();
  const shaped: ShapedGlyph[] = [];
  for (const ch of Array.from(text)) {
    let chosen: CaptionFont | null = null;
    for (const font of fonts) {
      if (font.charToGlyph(ch).index > 0) {
        chosen = font;
        break;
      }
    }
    if (!chosen) {
      if (/\s/u.test(ch)) {
        shaped.push({ ch, font: null, width: fonts[0].getAdvanceWidth(" ", fontSize) });
        continue;
      }
      throw new Error("caption_glyphs_missing");
    }
    shaped.push({ ch, font: chosen, width: chosen.getAdvanceWidth(ch, fontSize) });
  }
  return shaped;
}

function measureText(text: string, fontSize: number): number {
  return shapeText(text, fontSize).reduce((sum, glyph) => sum + glyph.width, 0);
}

function wrapCaption(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const chars = Array.from(paragraph);
    if (chars.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const ch of chars) {
      const next = current + ch;
      if (current && measureText(next, fontSize) > maxWidth) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines.filter((line, index, all) => line.length > 0 || all.length === 1);
}

interface Bounds {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

function contentBounds(data: Buffer, width: number, height: number, channels: number): Bounds | null {
  let top = height;
  let left = width;
  let bottom = -1;
  let right = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 248 || g < 248 || b < 248) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return null;
  return { top, left, bottom, right };
}

function regionIsLight(
  data: Buffer,
  width: number,
  channels: number,
  top: number,
  bottom: number,
): boolean {
  if (bottom < top) return false;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i] < 236 || data[i + 1] < 236 || data[i + 2] < 236) return false;
    }
  }
  return true;
}

/**
 * Draw spec text in the white margin under the product, or on a white band
 * added below the frame. The caption is never painted over the product silhouette.
 */
export async function compositeSpecCaption(image: Buffer, text: string): Promise<Buffer> {
  const caption = text.trim();
  if (!caption) throw new Error("empty_caption");

  const flattened = await sharp(image).rotate().flatten({ background: "#ffffff" }).png().toBuffer();
  const { data, info } = await sharp(flattened).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const bounds = contentBounds(data, width, height, channels);
  const fontSize = captionFontSize(width);
  const paddingX = Math.round(fontSize * 0.75);
  const paddingY = Math.round(fontSize * 0.55);
  const maxTextWidth = Math.max(fontSize, width - paddingX * 2);
  const lines = wrapCaption(caption, fontSize, maxTextWidth);
  const lineHeight = Math.round(fontSize * 1.35);
  const blockHeight = lines.length * lineHeight + paddingY * 2;
  const gap = Math.round(fontSize * 0.45);

  let canvasHeight = height;
  let captionTop = height - blockHeight;
  if (bounds) {
    const marginTop = bounds.bottom + 1;
    const spaceBelow = height - marginTop;
    const fitsBelow = spaceBelow >= blockHeight + gap
      && regionIsLight(data, width, channels, marginTop, height - 1);
    if (fitsBelow) {
      captionTop = marginTop + gap;
    } else {
      canvasHeight = height + gap + blockHeight;
      captionTop = height + Math.round(gap / 2);
    }
  } else if (blockHeight + gap > height) {
    canvasHeight = height + blockHeight;
    captionTop = height;
  }

  const paths: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const shaped = shapeText(lines[index], fontSize);
    const lineWidth = shaped.reduce((sum, glyph) => sum + glyph.width, 0);
    let x = Math.max(paddingX, Math.round((width - lineWidth) / 2));
    const baseline = captionTop + paddingY + fontSize + index * lineHeight;
    const commands: string[] = [];
    for (const glyph of shaped) {
      if (glyph.font) {
        const pathData = glyph.font.getPath(glyph.ch, x, baseline, fontSize).toPathData(2);
        if (pathData.trim()) commands.push(pathData);
      }
      x += glyph.width;
    }
    if (commands.length === 0) throw new Error("caption_glyphs_missing");
    paths.push(`<path d="${commands.join(" ")}" fill="#1a1a1a"/>`);
  }

  const svg = Buffer.from(
    `<svg width="${width}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">${paths.join("")}</svg>`,
  );

  if (canvasHeight === height) {
    return sharp(flattened).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
  }

  const band = await sharp({
    create: {
      width,
      height: canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).composite([{ input: flattened, top: 0, left: 0 }]).png().toBuffer();

  return sharp(band).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
}
