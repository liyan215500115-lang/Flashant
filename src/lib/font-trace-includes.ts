/**
 * Files read from assets/fonts at request time.
 * Next's output tracing does not follow these readFileSync paths, so each
 * route that loads them must list the same files here.
 *
 * Poster faces match src/lib/poster/fonts.ts, including optional Noto Sans CJK SC
 * files that are skipped when absent. Spec captions match src/lib/spec-caption.ts
 * and are already inside the poster set.
 */
const POSTER_AND_CAPTION_FONT_FILES = [
  "NotoSans-Bold.ttf",
  "NotoSans-Regular.ttf",
  "NotoSansCJKsc-Bold.otf",
  "NotoSansCJKsc-Regular.otf",
  "NotoSansJP-Bold.ttf",
  "NotoSansJP-Regular.ttf",
  "NotoSansKR-Bold.ttf",
  "NotoSansKR-Regular.ttf",
  "DroidSansFallbackFull.ttf",
] as const;

const FONT_TRACE_PATHS = POSTER_AND_CAPTION_FONT_FILES.map((file) => `./assets/fonts/${file}`);

export const FONT_TRACE_INCLUDES = {
  "/api/generate": FONT_TRACE_PATHS,
  "/api/generated-images/[id]/poster": FONT_TRACE_PATHS,
} as const;
