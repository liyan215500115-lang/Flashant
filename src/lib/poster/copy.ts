import { posterLanguage, type PosterLanguage } from "@/lib/poster/options";

/** Merchant poster copy. Example strings in the design pack are not defaults. */

export interface PosterTag {
  en: string;
  cn: string;
}

export interface PosterCopy {
  series: string;
  title: string;
  dek: string;
  tags: PosterTag[];
}

export type PosterTemplateChoice = "auto" | "A" | "B" | "C";

export type { PosterLanguage } from "@/lib/poster/options";

export interface PosterJob {
  template: PosterTemplateChoice;
  market: PosterLanguage;
  copy: PosterCopy;
  shotKey?: string;
}

/** Model, lifestyle, and on-body shots are out of v1. */
const NOT_POSTER_SHOTS = new Set([
  "lifestyle",
  "scene_atmosphere",
  "in_use",
  "brand_story",
  "gift_accessory",
]);

export function posterShotEligible(shotKey: string | undefined): boolean {
  if (!shotKey) return true;
  return !NOT_POSTER_SHOTS.has(shotKey);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePosterCopy(input: unknown): PosterCopy {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const tags: PosterTag[] = [];
  if (Array.isArray(src.tags)) {
    for (const tag of src.tags) {
      if (tags.length >= 3) break;
      if (!tag || typeof tag !== "object") continue;
      const rec = tag as { en?: unknown; cn?: unknown };
      const en = text(rec.en);
      const cn = text(rec.cn);
      if (!en) continue;
      tags.push({ en, cn });
    }
  }
  return {
    series: text(src.series),
    title: text(src.title),
    dek: text(src.dek),
    tags,
  };
}

/** Title and every layer above it are empty, so this image gets no poster type. */
export function posterHasType(copy: PosterCopy): boolean {
  return Boolean(copy.title || copy.series);
}

export function posterCopyLines(input: unknown): string[] {
  const copy = normalizePosterCopy(input);
  return [copy.series, copy.title, copy.dek, ...copy.tags.flatMap((tag) => [tag.en, tag.cn])]
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * A poster job exists only when the merchant turned the template on,
 * wrote a title or series, and the shot is in v1's still-life scope.
 */
export function parsePosterJob(input: unknown, shotKey?: string): PosterJob | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  if (rec.enabled !== true) return null;
  const copy = normalizePosterCopy(rec.copy);
  if (!posterHasType(copy)) return null;
  if (!posterShotEligible(shotKey)) return null;
  const template: PosterTemplateChoice = rec.template === "A" || rec.template === "B" || rec.template === "C"
    ? rec.template
    : "auto";
  return { template, market: posterLanguage(rec.market), copy, shotKey };
}

export function posterFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "caption_glyphs_missing" || message === "poster_not_persisted" || message === "poster_source_unavailable") {
    return message;
  }
  return "poster_overlay_failed";
}
