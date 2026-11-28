import sharp from "sharp";
import {
  type PosterCopy,
  type PosterJob,
  type PosterTemplateChoice,
  posterHasType,
} from "@/lib/poster/copy";
import {
  measurePosterText,
  shapePosterText,
  type PosterWeight,
  type ShapedGlyph,
} from "@/lib/poster/fonts";
import { type PosterLanguage } from "@/lib/poster/options";

export type PosterTemplate = "A" | "B" | "C";
export type FrameRatio = "portrait" | "square" | "landscape";

const INK = "#2A241C";
const PAPER = "#F3EEE6";
const PAPER_DEEP = "#E8E0D4";
const INK_FIELD = "#201B16";

const SOFT_BREAK = new Set(["，", "。", "、", ",", ".", ";", "；", "：", ":", "!", "！", "?", "？", " "]);

export interface PosterComposeResult {
  buffer: Buffer;
  template: PosterTemplate;
  requested: PosterTemplateChoice;
  fallback: "collision" | "contrast" | "white_ground" | "product_fill" | "fit" | null;
  market: string;
  copy: PosterCopy;
  canvas: { width: number; height: number };
  photo: { left: number; top: number; width: number; height: number };
  plinthHeight: number;
  masthead: number;
  /** Tops of the em boxes, used to prove empty layers leave no gap. */
  stack: { titleTop: number | null; dekTop: number | null; tagTop: number | null };
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Raster {
  width: number;
  height: number;
  channels: number;
  data: Buffer;
  bg: Rgb;
  whiteGround: boolean;
  productFill: boolean;
  mask: Uint8Array;
  step: number;
}

type Role = "series" | "title" | "dek" | "tagEn" | "tagCn";

interface Run {
  role: Role;
  text: string;
  x: number;
  baseline: number;
  fontSize: number;
  weight: PosterWeight;
  trackingEm: number;
  color: string;
  alpha: number;
  align: "left" | "right";
  contrastMin: number;
}

interface Plan {
  template: PosterTemplate;
  fallback: PosterComposeResult["fallback"];
  canvas: { width: number; height: number };
  photo: PosterComposeResult["photo"];
  plate: string | null;
  runs: Run[];
  plinthHeight: number;
  masthead: number;
}

function px(at1200: number, shortSide: number): number {
  return Math.max(1, Math.round((at1200 * shortSide) / 1200));
}

export function frameRatio(width: number, height: number): FrameRatio {
  const ratio = width / height;
  if (Math.abs(ratio - 1) <= 0.08) return "square";
  return ratio < 1 ? "portrait" : "landscape";
}

function brightness(color: Rgb): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = 0.2126 * channel(a.r) + 0.7152 * channel(a.g) + 0.0722 * channel(a.b);
  const l2 = 0.2126 * channel(b.r) + 0.7152 * channel(b.g) + 0.0722 * channel(b.b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function hexToRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  };
}

function pixelAt(raster: Raster, x: number, y: number): Rgb {
  const cx = Math.max(0, Math.min(raster.width - 1, x));
  const cy = Math.max(0, Math.min(raster.height - 1, y));
  const i = (cy * raster.width + cx) * raster.channels;
  return { r: raster.data[i], g: raster.data[i + 1], b: raster.data[i + 2] };
}

function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function medianChannel(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function analyze(data: Buffer, width: number, height: number, channels: number): Raster {
  const corner = Math.max(2, Math.round(Math.min(width, height) * 0.05));
  const samples: Rgb[] = [];
  const origins = [
    [0, 0],
    [width - corner, 0],
    [0, height - corner],
    [width - corner, height - corner],
  ];
  for (const [ox, oy] of origins) {
    for (let y = oy; y < oy + corner; y += 2) {
      for (let x = ox; x < ox + corner; x += 2) {
        samples.push(pixelAt({ data, width, height, channels } as Raster, x, y));
      }
    }
  }
  const bg = {
    r: medianChannel(samples.map((sample) => sample.r)),
    g: medianChannel(samples.map((sample) => sample.g)),
    b: medianChannel(samples.map((sample) => sample.b)),
  };
  const step = Math.max(1, Math.floor(Math.max(width, height) / 480));
  const maskW = Math.ceil(width / step);
  const maskH = Math.ceil(height / step);
  const mask = new Uint8Array(maskW * maskH);
  let product = 0;
  let cells = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const color = pixelAt({ data, width, height, channels } as Raster, x, y);
      const hit = colorDistance(color, bg) > 42 ? 1 : 0;
      mask[(Math.floor(y / step) * maskW) + Math.floor(x / step)] = hit;
      product += hit;
      cells += 1;
    }
  }
  const fraction = cells ? product / cells : 0;
  const whiteGround = brightness(bg) >= 225 && fraction < 0.72;
  return {
    width,
    height,
    channels,
    data,
    bg,
    whiteGround,
    productFill: fraction >= 0.62,
    mask,
    step,
  };
}

function isProduct(raster: Raster, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return false;
  const mx = Math.floor(x / raster.step);
  const my = Math.floor(y / raster.step);
  const maskW = Math.ceil(raster.width / raster.step);
  return raster.mask[my * maskW + mx] === 1;
}

function coverage(raster: Raster, rect: Rect): number {
  let hit = 0;
  let seen = 0;
  const stride = Math.max(raster.step, 2);
  for (let y = rect.top; y < rect.bottom; y += stride) {
    for (let x = rect.left; x < rect.right; x += stride) {
      seen += 1;
      if (isProduct(raster, x, y)) hit += 1;
    }
  }
  return seen ? hit / seen : 0;
}

function medianRgb(raster: Raster, rect: Rect): Rgb {
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  const stride = Math.max(raster.step, 2);
  for (let y = Math.max(0, rect.top); y < Math.min(raster.height, rect.bottom); y += stride) {
    for (let x = Math.max(0, rect.left); x < Math.min(raster.width, rect.right); x += stride) {
      const color = pixelAt(raster, x, y);
      reds.push(color.r);
      greens.push(color.g);
      blues.push(color.b);
    }
  }
  return { r: medianChannel(reds), g: medianChannel(greens), b: medianChannel(blues) };
}

function inkFor(median: Rgb): { color: string; softAlpha: number } {
  if (brightness(median) < 110) return { color: PAPER, softAlpha: 0.78 };
  return { color: INK, softAlpha: 0.72 };
}

function bandContrast(raster: Raster, rect: Rect, minRatio: number, soft: boolean): boolean {
  const median = medianRgb(raster, rect);
  const ink = inkFor(median);
  const alpha = soft ? ink.softAlpha : 1;
  const blended = blend(hexToRgb(ink.color), median, alpha);
  return contrastRatio(blended, median) >= minRatio;
}

function wrapLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: PosterWeight,
  trackingEm: number,
  maxLines: number,
  language: PosterLanguage,
): string[] {
  const chars = Array.from(text.trim());
  const lines: string[] = [];
  let index = 0;
  const measure = (value: string) => measurePosterText(value, fontSize, weight, trackingEm, language);
  while (index < chars.length && lines.length < maxLines) {
    let end = index;
    let lastSoft = -1;
    while (end < chars.length && measure(chars.slice(index, end + 1).join("")) <= maxWidth) {
      if (SOFT_BREAK.has(chars[end]) && end > index) lastSoft = end;
      end += 1;
    }
    if (end === index) end = index + 1;
    else if (end < chars.length && lastSoft >= index && lines.length < maxLines - 1) end = lastSoft + 1;
    const line = chars.slice(index, end).join("").trim();
    if (/^[，。、,.;；：:!！？?\s]+$/u.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line;
    } else if (line) lines.push(line);
    index = end;
    while (index < chars.length && chars[index] === " ") index += 1;
  }
  return lines;
}

function fitSingleLine(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: PosterWeight,
  trackingEm: number,
  language: PosterLanguage,
): string {
  const chars = Array.from(text.trim());
  const measure = (value: string) => measurePosterText(value, fontSize, weight, trackingEm, language);
  if (chars.length === 0) return "";
  if (measure(chars.join("")) <= maxWidth) return chars.join("");
  let end = chars.length;
  while (end > 1 && measure(chars.slice(0, end).join("")) > maxWidth) end -= 1;
  let cut = end;
  for (let index = end - 1; index > Math.floor(end * 0.45); index -= 1) {
    const prev = chars[index - 1];
    const current = chars[index];
    if (current === " " || /[A-Za-z0-9]/.test(prev) !== /[A-Za-z0-9]/.test(current)) {
      cut = current === " " ? index : index;
      break;
    }
  }
  return chars.slice(0, cut).join("").trim();
}

function titleSizes(template: PosterTemplate, ratio: FrameRatio, shortSide: number): number[] {
  const floor = px(44, shortSide);
  const preferred = template === "A"
    ? (ratio === "portrait" ? [80, 64] : [64])
    : template === "B"
      ? (ratio === "square" ? [56] : [96, 80, 64])
      : [72, 64];
  const sizes = preferred.map((size) => px(size, shortSide)).filter((size) => size >= floor);
  sizes.push(floor);
  return [...new Set(sizes)];
}

function placeStack(
  copy: PosterCopy,
  titleSize: number,
  shortSide: number,
  maxWidth: number,
  originX: number,
  originY: number,
  color: string,
  softAlpha: number,
  align: "left" | "right",
  language: PosterLanguage,
): { runs: Run[]; height: number } {
  const seriesSize = px(22, shortSide);
  const dekSize = px(26, shortSide);
  const tagEnSize = px(18, shortSide);
  const tagCnSize = px(16, shortSide);
  const cnGap = px(6, shortSide);
  const groupGap = px(48, shortSide);
  const runs: Run[] = [];
  let cursor = originY;
  const push = (role: Role, text: string, fontSize: number, weight: PosterWeight, trackingEm: number, contrastMin: number) => {
    const baseline = cursor + fontSize;
    runs.push({
      role,
      text,
      x: align === "left" ? originX : originX + maxWidth,
      baseline,
      fontSize,
      weight,
      trackingEm,
      color,
      alpha: role === "title" ? 1 : softAlpha,
      align,
      contrastMin,
    });
    cursor = baseline;
  };

  if (copy.series) {
    push("series", fitSingleLine(copy.series, maxWidth, seriesSize, "bold", 0.1, language), seriesSize, "bold", 0.1, 3.5);
    cursor += px(14, shortSide);
  }
  if (copy.title) {
    const lines = wrapLines(copy.title, maxWidth, titleSize, "bold", 0, 2, language);
    lines.forEach((line, index) => {
      push("title", line, titleSize, "bold", 0, 4.5);
      if (index < lines.length - 1) cursor += Math.round(titleSize * 0.1);
    });
    cursor += px(16, shortSide);
  }
  if (copy.dek) {
    const lines = wrapLines(copy.dek, maxWidth, dekSize, "regular", 0, 2, language);
    lines.forEach((line, index) => {
      push("dek", line, dekSize, "regular", 0, 3.5);
      if (index < lines.length - 1) cursor += Math.round(dekSize * 0.45);
    });
    cursor += px(18, shortSide);
  }
  if (copy.tags.length > 0) {
    copy.tags.forEach((tag, index) => {
      push("tagEn", fitSingleLine(tag.en.toUpperCase(), maxWidth, tagEnSize, "bold", 0.14, language), tagEnSize, "bold", 0.14, 3.5);
      if (tag.cn) {
        cursor += cnGap;
        push("tagCn", fitSingleLine(tag.cn, maxWidth, tagCnSize, "regular", 0, language), tagCnSize, "regular", 0, 3.5);
      }
      if (index < copy.tags.length - 1) cursor += groupGap;
    });
  }
  const last = runs[runs.length - 1];
  const height = last ? (last.baseline + Math.round(last.fontSize * 0.25)) - originY : 0;
  return { runs, height };
}

function stackMetrics(runs: Run[]): PosterComposeResult["stack"] {
  const top = (role: Role) => {
    const run = runs.find((item) => item.role === role);
    return run ? run.baseline - run.fontSize : null;
  };
  return { titleTop: top("title"), dekTop: top("dek"), tagTop: top("tagEn") };
}

function runBounds(run: Run, shaped: ShapedGlyph[]): Rect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const total = shaped.reduce((sum, glyph) => sum + glyph.width, 0);
  let x = run.align === "left" ? run.x : run.x - total;
  for (const glyph of shaped) {
    if (glyph.face) {
      const box = glyph.face.font.getPath(glyph.ch, x, run.baseline, run.fontSize).getBoundingBox();
      if (Number.isFinite(box.x1) && box.x2 > box.x1) {
        left = Math.min(left, box.x1);
        top = Math.min(top, box.y1);
        right = Math.max(right, box.x2);
        bottom = Math.max(bottom, box.y2);
      }
    }
    x += glyph.width;
  }
  if (!Number.isFinite(left)) return null;
  return {
    left: Math.floor(left),
    top: Math.floor(top),
    right: Math.ceil(right),
    bottom: Math.ceil(bottom),
  };
}

function hitsProduct(raster: Raster, rect: Rect, pad: number): boolean {
  for (let y = rect.top - pad; y <= rect.bottom + pad; y += Math.max(1, raster.step)) {
    for (let x = rect.left - pad; x <= rect.right + pad; x += Math.max(1, raster.step)) {
      if (isProduct(raster, x, y)) return true;
    }
  }
  return false;
}

function runContrastFails(raster: Raster, run: Run, rect: Rect): boolean {
  const median = medianRgb(raster, rect);
  const blended = blend(hexToRgb(run.color), median, run.alpha);
  return contrastRatio(blended, median) < run.contrastMin;
}

function photoFillsTextBands(raster: Raster, ratio: FrameRatio): boolean {
  const shortSide = Math.min(raster.width, raster.height);
  const margin = px(80, shortSide);
  if (ratio === "landscape") {
    const column = { left: margin, top: margin, right: px(620, shortSide), bottom: raster.height - margin };
    return coverage(raster, column) > 0.12;
  }
  const upper = { left: margin, top: margin, right: raster.width - margin, bottom: Math.round(raster.height * 0.3) };
  const lower = { left: margin, top: Math.round(raster.height * 0.84), right: raster.width - margin, bottom: raster.height - margin };
  return coverage(raster, upper) > 0.12 && coverage(raster, lower) > 0.12;
}

function quietEnough(raster: Raster, ratio: FrameRatio): boolean {
  const shortSide = Math.min(raster.width, raster.height);
  const margin = px(80, shortSide);
  if (ratio === "landscape" || ratio === "square") {
    const column = {
      left: margin,
      top: margin,
      right: Math.min(raster.width - margin, px(620, shortSide)),
      bottom: raster.height - margin,
    };
    return coverage(raster, column) < 0.08
      && bandContrast(raster, column, 4.5, false)
      && bandContrast(raster, column, 3.5, true);
  }
  const upper = { left: margin, top: margin, right: raster.width - margin, bottom: Math.round(raster.height * 0.3) };
  const lower = { left: margin, top: Math.round(raster.height * 0.84), right: raster.width - margin, bottom: raster.height - margin };
  return coverage(raster, upper) < 0.08
    && coverage(raster, lower) < 0.08
    && bandContrast(raster, upper, 4.5, false)
    && bandContrast(raster, lower, 3.5, true);
}

function chooseTemplate(
  job: PosterJob,
  raster: Raster,
): { template: PosterTemplate; fallback: PosterComposeResult["fallback"] } {
  const ratio = frameRatio(raster.width, raster.height);
  const forcedB = raster.whiteGround || raster.productFill || photoFillsTextBands(raster, ratio);
  const closeup = job.shotKey === "material" || job.shotKey === "detail";
  const suggested: PosterTemplate = closeup && !raster.whiteGround ? "C" : forcedB || !quietEnough(raster, ratio) ? "B" : "A";
  if (job.template === "B") return { template: "B", fallback: null };
  if (job.template === "C") return { template: "C", fallback: null };
  if (job.template === "A") {
    if (raster.whiteGround) return { template: "B", fallback: "white_ground" };
    if (raster.productFill || photoFillsTextBands(raster, ratio)) return { template: "B", fallback: "product_fill" };
    return { template: "A", fallback: null };
  }
  return { template: suggested, fallback: suggested === "B" && !closeup ? (raster.whiteGround ? "white_ground" : raster.productFill ? "product_fill" : null) : null };
}

function planA(copy: PosterCopy, raster: Raster, titleSize: number, language: PosterLanguage): Plan | "overflow" {
  const ratio = frameRatio(raster.width, raster.height);
  const shortSide = Math.min(raster.width, raster.height);
  const margin = px(80, shortSide);
  const landscape = ratio !== "portrait";
  const columnRight = Math.min(raster.width - margin, px(620, shortSide));
  const maxWidth = landscape ? columnRight - margin : raster.width - margin * 2;
  const upperBottom = Math.round(raster.height * 0.3);
  const lowerTop = Math.round(raster.height * 0.84);
  const upperMedian = medianRgb(raster, {
    left: margin,
    top: margin,
    right: landscape ? columnRight : raster.width - margin,
    bottom: landscape ? Math.round(raster.height * 0.45) : upperBottom,
  });
  const lowerMedian = medianRgb(raster, {
    left: margin,
    top: landscape ? Math.round(raster.height * 0.45) : lowerTop,
    right: landscape ? columnRight : raster.width - margin,
    bottom: raster.height - margin,
  });
  const upperInk = inkFor(upperMedian);
  const lowerInk = inkFor(landscape ? upperMedian : lowerMedian);
  const upper = placeStack(
    { ...copy, dek: "", tags: [] },
    titleSize,
    shortSide,
    maxWidth,
    margin,
    margin,
    upperInk.color,
    upperInk.softAlpha,
    "left",
    language,
  );
  const lowerCopy = { series: "", title: "", dek: copy.dek, tags: copy.tags };
  const lowerOrigin = landscape ? margin + upper.height + px(18, shortSide) : lowerTop;
  const lower = placeStack(lowerCopy, titleSize, shortSide, maxWidth, margin, lowerOrigin, lowerInk.color, lowerInk.softAlpha, "left", language);
  const runs = landscape ? [...upper.runs, ...lower.runs] : [...upper.runs, ...lower.runs];
  const limit = landscape ? raster.height - margin : upperBottom;
  const upperOverflow = upper.runs.some((run) => run.baseline + run.fontSize * 0.25 > (landscape ? raster.height - margin : limit));
  const lowerOverflow = lower.runs.some((run) => run.baseline + run.fontSize * 0.25 > raster.height - margin);
  const crossed = !landscape && lower.runs.length > 0 && upper.runs.some((run) => run.baseline > upperBottom);
  if (upperOverflow || lowerOverflow || crossed || maxWidth < px(44, shortSide)) return "overflow";
  return {
    template: "A",
    fallback: null,
    canvas: { width: raster.width, height: raster.height },
    photo: { left: 0, top: 0, width: raster.width, height: raster.height },
    plate: null,
    runs,
    plinthHeight: 0,
    masthead: 0,
  };
}

function planB(copy: PosterCopy, raster: Raster, titleSize: number, language: PosterLanguage): Plan {
  const ratio = frameRatio(raster.width, raster.height);
  const shortSide = Math.min(raster.width, raster.height);
  const padX = ratio === "square" ? px(48, shortSide) : px(80, shortSide);
  const padTop = ratio === "square" ? px(48, shortSide) : px(56, shortSide);
  const padBottom = px(48, shortSide);
  const light = brightness(raster.bg) >= 150;
  const plate = light ? PAPER_DEEP : INK_FIELD;
  const ink = light ? { color: INK, softAlpha: 0.72 } : { color: PAPER, softAlpha: 0.78 };
  let rail = ratio === "square"
    ? Math.round(raster.width * 0.38 / 0.62)
    : ratio === "landscape"
      ? px(450, shortSide)
      : Math.round(raster.height * 0.36 / 0.64);
  const textWidthOf = () => Math.max(px(40, shortSide), (ratio === "square" ? rail : raster.width) - padX * 2);
  const blocksAt = (width: number) => ({
    head: placeStack({ ...copy, dek: "", tags: [] }, titleSize, shortSide, width, padX, 0, ink.color, ink.softAlpha, "left", language),
    dek: copy.dek
      ? placeStack({ series: "", title: "", dek: copy.dek, tags: [] }, titleSize, shortSide, width, padX, 0, ink.color, ink.softAlpha, "left", language)
      : { runs: [] as Run[], height: 0 },
    tags: copy.tags.length
      ? placeStack({ series: "", title: "", dek: "", tags: copy.tags }, titleSize, shortSide, width, padX, 0, ink.color, ink.softAlpha, "left", language)
      : { runs: [] as Run[], height: 0 },
  });
  let blocks = blocksAt(textWidthOf());
  const gap = px(16, shortSide);
  const needed = () => padTop + padBottom + blocks.head.height + blocks.dek.height + blocks.tags.height
    + (copy.dek ? gap : 0)
    + (copy.tags.length && copy.dek ? gap : 0);
  let guard = 0;
  while (needed() > rail && guard < 48) {
    rail += px(20, shortSide);
    if (ratio === "square") blocks = blocksAt(textWidthOf());
    guard += 1;
  }
  const width = textWidthOf();
  let runs: Run[];
  if (!copy.dek && copy.tags.length === 0) {
    const y = Math.max(padTop, Math.round((rail - blocks.head.height) / 2));
    runs = placeStack({ ...copy, dek: "", tags: [] }, titleSize, shortSide, width, padX, y, ink.color, ink.softAlpha, "left", language).runs;
  } else if (!copy.dek || copy.tags.length === 0) {
    runs = placeStack(copy, titleSize, shortSide, width, padX, padTop, ink.color, ink.softAlpha, "left", language).runs;
  } else {
    const head = placeStack({ ...copy, dek: "", tags: [] }, titleSize, shortSide, width, padX, padTop, ink.color, ink.softAlpha, "left", language);
    const dek = placeStack(
      { series: "", title: "", dek: copy.dek, tags: [] },
      titleSize,
      shortSide,
      width,
      padX,
      padTop + head.height + gap,
      ink.color,
      ink.softAlpha,
      "left",
      language,
    );
    const tags = placeStack(
      { series: "", title: "", dek: "", tags: copy.tags },
      titleSize,
      shortSide,
      width,
      padX,
      rail - padBottom - blocks.tags.height,
      ink.color,
      ink.softAlpha,
      "left",
      language,
    );
    runs = [...head.runs, ...dek.runs, ...tags.runs];
  }
  if (ratio === "square") {
    return {
      template: "B",
      fallback: null,
      canvas: { width: raster.width + rail, height: raster.height },
      photo: { left: rail, top: 0, width: raster.width, height: raster.height },
      plate,
      runs,
      plinthHeight: 0,
      masthead: rail,
    };
  }
  return {
    template: "B",
    fallback: null,
    canvas: { width: raster.width, height: raster.height + rail },
    photo: { left: 0, top: rail, width: raster.width, height: raster.height },
    plate,
    runs,
    plinthHeight: 0,
    masthead: rail,
  };
}

function planC(copy: PosterCopy, raster: Raster, titleSize: number, language: PosterLanguage): Plan {
  const shortSide = Math.min(raster.width, raster.height);
  const padX = px(80, shortSide);
  const padY = px(36, shortSide);
  const split = Math.round(raster.width * 0.62);
  const leftWidth = Math.max(px(80, shortSide), split - padX);
  const rightWidth = Math.max(px(80, shortSide), raster.width - split - padX);
  const left = placeStack(
    { ...copy, tags: [] },
    titleSize,
    shortSide,
    leftWidth,
    padX,
    0,
    INK,
    0.72,
    "left",
    language,
  );
  const right = placeStack(
    { series: "", title: "", dek: "", tags: copy.tags },
    titleSize,
    shortSide,
    rightWidth,
    split,
    0,
    INK,
    0.72,
    "right",
    language,
  );
  const content = Math.max(left.height, right.height);
  const full = Boolean(copy.series && copy.title && copy.dek && copy.tags.length > 0);
  const defaultPlinth = Math.round(raster.height * 0.25 / 0.75);
  const plinth = full ? Math.max(defaultPlinth, content + padY * 2) : Math.max(px(72, shortSide), content + padY * 2);
  const shift = raster.height + padY;
  const runs = [...left.runs, ...right.runs].map((run) => ({ ...run, baseline: run.baseline + shift }));
  return {
    template: "C",
    fallback: null,
    canvas: { width: raster.width, height: raster.height + plinth },
    photo: { left: 0, top: 0, width: raster.width, height: raster.height },
    plate: PAPER_DEEP,
    runs,
    plinthHeight: plinth,
    masthead: 0,
  };
}

function titleFits(copy: PosterCopy, titleSize: number, maxWidth: number, language: PosterLanguage): boolean {
  if (!copy.title) return true;
  const lines = wrapLines(copy.title, maxWidth, titleSize, "bold", 0, 2, language);
  return lines.every((line) => measurePosterText(line, titleSize, "bold", 0, language) <= maxWidth + 0.5);
}

function planTemplate(
  template: PosterTemplate,
  copy: PosterCopy,
  raster: Raster,
  language: PosterLanguage,
): Plan | "overflow" {
  const ratio = frameRatio(raster.width, raster.height);
  const shortSide = Math.min(raster.width, raster.height);
  const sizes = titleSizes(template, ratio, shortSide);
  if (template === "A") {
    for (const size of sizes) {
      const planned = planA(copy, raster, size, language);
      if (planned !== "overflow") return planned;
    }
    return "overflow";
  }
  const margin = template === "B" && ratio === "square" ? px(48, shortSide) : px(80, shortSide);
  const column = template === "C"
    ? Math.round(raster.width * 0.62) - margin
    : ratio === "square"
      ? Math.round(raster.width * 0.38 / 0.62) - margin * 2
      : raster.width - margin * 2;
  let chosen = sizes[sizes.length - 1];
  for (const size of sizes) {
    chosen = size;
    if (titleFits(copy, size, Math.max(px(40, shortSide), column), language)) break;
  }
  return template === "B" ? planB(copy, raster, chosen, language) : planC(copy, raster, chosen, language);
}

function inspectA(plan: Plan, raster: Raster, language: PosterLanguage): "collision" | "contrast" | null {
  const pad = px(4, Math.min(raster.width, raster.height));
  for (const run of plan.runs) {
    const shaped = shapePosterText(run.text, run.fontSize, run.weight, run.trackingEm, language);
    const bounds = runBounds(run, shaped);
    if (!bounds) throw new Error("caption_glyphs_missing");
    if (hitsProduct(raster, bounds, pad)) return "collision";
    if (runContrastFails(raster, run, bounds)) return "contrast";
  }
  return null;
}

function svgFor(runs: Run[], width: number, height: number, language: PosterLanguage): Buffer {
  const paths: string[] = [];
  for (const run of runs) {
    const shaped = shapePosterText(run.text, run.fontSize, run.weight, run.trackingEm, language);
    const total = shaped.reduce((sum, glyph) => sum + glyph.width, 0);
    let x = run.align === "left" ? run.x : run.x - total;
    const commands: string[] = [];
    let synthetic = false;
    for (const glyph of shaped) {
      if (glyph.face) {
        const data = glyph.face.font.getPath(glyph.ch, x, run.baseline, run.fontSize).toPathData(1);
        if (!data.trim()) throw new Error("caption_glyphs_missing");
        commands.push(data);
        if (glyph.syntheticBold) synthetic = true;
      }
      x += glyph.width;
    }
    if (commands.length === 0) throw new Error("caption_glyphs_missing");
    const fill = run.alpha >= 0.999
      ? run.color
      : `rgba(${hexToRgb(run.color).r},${hexToRgb(run.color).g},${hexToRgb(run.color).b},${run.alpha})`;
    const stroke = synthetic
      ? ` stroke="${fill}" stroke-width="${Math.max(0.6, run.fontSize * 0.03).toFixed(2)}" stroke-linejoin="round"`
      : "";
    paths.push(`<path d="${commands.join(" ")}" fill="${fill}"${stroke}/>`);
  }
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${paths.join("")}</svg>`,
  );
}

async function renderPlan(photo: Buffer, plan: Plan, language: PosterLanguage): Promise<Buffer> {
  let base: Buffer;
  if (!plan.plate) {
    base = photo;
  } else {
    const color = hexToRgb(plan.plate);
    const plate = await sharp({
      create: {
        width: plan.canvas.width,
        height: plan.canvas.height,
        channels: 3,
        background: color,
      },
    }).png().toBuffer();
    base = await sharp(plate).composite([{
      input: photo,
      left: plan.photo.left,
      top: plan.photo.top,
    }]).png().toBuffer();
  }
  const svg = svgFor(plan.runs, plan.canvas.width, plan.canvas.height, language);
  return sharp(base).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
}

function resultFrom(job: PosterJob, plan: Plan, buffer: Buffer): PosterComposeResult {
  return {
    buffer,
    template: plan.template,
    requested: job.template,
    fallback: plan.fallback,
    market: job.market,
    copy: job.copy,
    canvas: plan.canvas,
    photo: plan.photo,
    plinthHeight: plan.plinthHeight,
    masthead: plan.masthead,
    stack: stackMetrics(plan.runs),
  };
}

/**
 * Draw a poster on a copy of the unlettered photo.
 * Returns null when there is nothing to letter. Throws caption_glyphs_missing
 * instead of painting a .notdef box. Template A falls back to B; B only grows
 * the rail and never puts type on the photo.
 */
export async function composePoster(image: Buffer, job: PosterJob): Promise<PosterComposeResult | null> {
  if (!posterHasType(job.copy)) return null;
  const oriented = await sharp(image).rotate().png().toBuffer();
  const { data, info } = await sharp(oriented).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const raster = analyze(data, info.width, info.height, info.channels);
  const choice = chooseTemplate(job, raster);
  let template = choice.template;
  let fallback = choice.fallback;
  let planned = planTemplate(template, job.copy, raster, job.market);
  if (template === "A") {
    if (planned === "overflow") {
      template = "B";
      fallback = "fit";
      planned = planTemplate("B", job.copy, raster, job.market);
    } else {
      const problem = inspectA(planned, raster, job.market);
      if (problem) {
        template = "B";
        fallback = problem;
        planned = planTemplate("B", job.copy, raster, job.market);
      }
    }
  }
  if (planned === "overflow") {
    planned = planTemplate("B", job.copy, raster, job.market);
    fallback = fallback ?? "fit";
  }
  if (planned === "overflow") throw new Error("poster_overlay_failed");
  planned.fallback = fallback;
  const buffer = await renderPlan(oriented, planned, job.market);
  return resultFrom(job, planned, buffer);
}
