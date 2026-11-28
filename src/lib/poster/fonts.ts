import { existsSync, readFileSync } from "fs";
import path from "path";
import { parse as parseFont } from "opentype.js";
import { type PosterLanguage } from "@/lib/poster/options";

/**
 * Poster faces, in preference order.
 * Latin uses the bundled Noto Sans family (same OFL files as spec captions).
 * Han uses Source Han / Noto CJK SC when those files are added, then Droid Sans
 * Fallback, which already covers CJK ideographs. Kana and hangul prefer the
 * bundled Noto Sans JP / KR faces so a later language does not need a new shaper.
 * A missing optional file is skipped. A character no face can draw fails closed.
 */
export type PosterScript = "latn" | "hani" | "jpan" | "kore";
export type PosterWeight = "regular" | "bold";

export interface FontFaceSpec {
  id: string;
  file: string;
  weight: PosterWeight;
  scripts: PosterScript[];
  optional?: boolean;
}

export const POSTER_FONT_FACES: FontFaceSpec[] = [
  { id: "noto-sans-bold", file: "NotoSans-Bold.ttf", weight: "bold", scripts: ["latn"] },
  { id: "noto-sans-regular", file: "NotoSans-Regular.ttf", weight: "regular", scripts: ["latn"] },
  { id: "noto-cjk-sc-bold", file: "NotoSansCJKsc-Bold.otf", weight: "bold", scripts: ["hani"], optional: true },
  { id: "noto-cjk-sc-regular", file: "NotoSansCJKsc-Regular.otf", weight: "regular", scripts: ["hani"], optional: true },
  { id: "noto-sans-jp-bold", file: "NotoSansJP-Bold.ttf", weight: "bold", scripts: ["jpan"] },
  { id: "noto-sans-jp-regular", file: "NotoSansJP-Regular.ttf", weight: "regular", scripts: ["jpan"] },
  { id: "noto-sans-kr-bold", file: "NotoSansKR-Bold.ttf", weight: "bold", scripts: ["kore"] },
  { id: "noto-sans-kr-regular", file: "NotoSansKR-Regular.ttf", weight: "regular", scripts: ["kore"] },
  { id: "droid-sans-fallback", file: "DroidSansFallbackFull.ttf", weight: "regular", scripts: ["hani", "jpan", "kore"] },
];

interface LoadedFace {
  spec: FontFaceSpec;
  font: {
    getPath(text: string, x: number, y: number, fontSize: number): {
      toPathData(decimalPlaces?: number): string;
      getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
    };
    getAdvanceWidth(text: string, fontSize: number): number;
    charToGlyph(text: string): { index: number };
  };
}

export interface ShapedGlyph {
  ch: string;
  face: LoadedFace | null;
  width: number;
  syntheticBold: boolean;
}

let cache: LoadedFace[] | null = null;

/**
 * Faces allowed for a language, in preference order.
 * zh/en share Noto Sans Latin plus Source Han / Noto CJK SC (Droid until the
 * SC files are added), so mixed Chinese and English stay in that family.
 * ja and ko prefer their own Noto faces. A language never borrows another
 * language's family just because a character's script would match it.
 */
export function faceIdsForLanguage(language: PosterLanguage): string[] {
  const latin = ["noto-sans-bold", "noto-sans-regular"];
  const han = ["noto-cjk-sc-bold", "noto-cjk-sc-regular", "droid-sans-fallback"];
  if (language === "ja") return [...latin, "noto-sans-jp-bold", "noto-sans-jp-regular", "droid-sans-fallback"];
  if (language === "ko") return [...latin, "noto-sans-kr-bold", "noto-sans-kr-regular", "droid-sans-fallback"];
  return [...latin, ...han];
}

function loadFaces(): LoadedFace[] {
  if (cache) return cache;
  const loaded: LoadedFace[] = [];
  for (const spec of POSTER_FONT_FACES) {
    const fontPath = path.join(process.cwd(), "assets", "fonts", spec.file);
    if (!existsSync(fontPath)) {
      if (spec.optional) continue;
      throw new Error(`poster_font_missing:${spec.file}`);
    }
    loaded.push({ spec, font: parseFont(readFileSync(fontPath)) });
  }
  cache = loaded;
  return loaded;
}

/**
 * Prefer a real glyph (index > 0) in the requested weight.
 * A bold request may use the regular face of the same script when no bold
 * file contains that glyph. Nothing may be drawn as .notdef.
 */
export function shapePosterText(
  text: string,
  fontSize: number,
  weight: PosterWeight,
  trackingEm = 0,
  language: PosterLanguage = "zh",
): ShapedGlyph[] {
  const allowed = new Set(faceIdsForLanguage(language));
  const faces = loadFaces().filter((face) => allowed.has(face.spec.id));
  const tracking = trackingEm * fontSize;
  const chars = Array.from(text);
  const shaped: ShapedGlyph[] = [];
  chars.forEach((ch, index) => {
    if (/\s/u.test(ch)) {
      const latin = faces.find((face) => face.spec.scripts.includes("latn") && face.spec.weight === "regular") ?? faces[0];
      shaped.push({
        ch,
        face: null,
        width: latin.font.getAdvanceWidth(" ", fontSize),
        syntheticBold: false,
      });
      return;
    }
    const candidates = faces.filter((face) => face.font.charToGlyph(ch).index > 0);
    const weighted = candidates.filter((face) => face.spec.weight === weight);
    const chosen = weighted[0] ?? candidates[0];
    if (!chosen) throw new Error("caption_glyphs_missing");
    const advance = chosen.font.getAdvanceWidth(ch, fontSize);
    const extra = index < chars.length - 1 ? tracking : 0;
    shaped.push({
      ch,
      face: chosen,
      width: advance + extra,
      syntheticBold: weight === "bold" && chosen.spec.weight !== "bold",
    });
  });
  return shaped;
}

export function measurePosterText(
  text: string,
  fontSize: number,
  weight: PosterWeight,
  trackingEm = 0,
  language: PosterLanguage = "zh",
): number {
  return shapePosterText(text, fontSize, weight, trackingEm, language)
    .reduce((sum, glyph) => sum + glyph.width, 0);
}
