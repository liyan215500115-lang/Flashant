/** Languages the workbench can select. Copy text does not choose this. */
export const POSTER_LANGUAGES = ["zh", "en", "ja", "ko"] as const;

export type PosterLanguage = (typeof POSTER_LANGUAGES)[number];

export function posterLanguage(value: unknown): PosterLanguage {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "en" || raw.startsWith("en-")) return "en";
  if (raw === "ja" || raw === "jp" || raw.startsWith("ja-")) return "ja";
  if (raw === "ko" || raw === "kr" || raw.startsWith("ko-")) return "ko";
  return "zh";
}

export function isPosterLanguage(value: string): value is PosterLanguage {
  return (POSTER_LANGUAGES as readonly string[]).includes(value);
}
