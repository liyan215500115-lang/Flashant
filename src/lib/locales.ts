export const LOCALE_OPTIONS = [
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "中文", short: "中文" },
  { code: "ja", label: "日本語", short: "日本語" },
  { code: "es", label: "Español", short: "ES" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "pt-BR", label: "Português", short: "PT" },
  { code: "ko", label: "한국어", short: "한국어" },
  { code: "it", label: "Italiano", short: "IT" },
  { code: "ar", label: "العربية", short: "AR" },
] as const;

export type AppLocale = (typeof LOCALE_OPTIONS)[number]["code"];

export const DEFAULT_LOCALE: AppLocale = "en";

const LOCALE_SET = new Set<string>(LOCALE_OPTIONS.map((locale) => locale.code));

export function resolveLocale(value: string | undefined | null): AppLocale {
  if (!value) return DEFAULT_LOCALE;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  return LOCALE_SET.has(decoded) ? (decoded as AppLocale) : DEFAULT_LOCALE;
}

export function localeShortLabel(locale: string): string {
  return LOCALE_OPTIONS.find((option) => option.code === locale)?.short ?? locale;
}
