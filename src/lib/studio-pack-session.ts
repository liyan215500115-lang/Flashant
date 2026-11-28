export const GENERAL_PACK = ["selling_points", "detail", "multi_angle", "lifestyle"] as const;

const STORAGE_PREFIX = "flashant.studioPack.v1";

export interface PackPosterDraft {
  enabled: boolean;
  language: "zh" | "en" | "ja" | "ko";
  template: "auto" | "A" | "B" | "C";
  series: string;
  title: string;
  dek: string;
  tags: Array<{ en: string; cn: string }>;
}

export interface PackDraft {
  selected: string[];
  category: string;
  lockStyle: boolean;
  perTypeDesc: Record<string, string>;
  open: boolean;
  poster?: PackPosterDraft;
}

export function packStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}:${projectId}`;
}

function posterDraft(value: unknown): PackPosterDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rec = value as Partial<PackPosterDraft>;
  const language = rec.language === "en" || rec.language === "ja" || rec.language === "ko" ? rec.language : "zh";
  const template = rec.template === "A" || rec.template === "B" || rec.template === "C" ? rec.template : "auto";
  const tags = Array.isArray(rec.tags)
    ? rec.tags.slice(0, 3).map((tag) => ({
      en: typeof tag?.en === "string" ? tag.en : "",
      cn: typeof tag?.cn === "string" ? tag.cn : "",
    }))
    : [];
  while (tags.length < 3) tags.push({ en: "", cn: "" });
  return {
    enabled: rec.enabled === true,
    language,
    template,
    series: typeof rec.series === "string" ? rec.series : "",
    title: typeof rec.title === "string" ? rec.title : "",
    dek: typeof rec.dek === "string" ? rec.dek : "",
    tags,
  };
}

export function readPackDraft(projectId: string, storage?: Storage): PackDraft | null {
  const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (!target) return null;
  try {
    const raw = target.getItem(packStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PackDraft>;
    if (!parsed || !Array.isArray(parsed.selected)) return null;
    return {
      selected: parsed.selected.filter((key) => typeof key === "string"),
      category: typeof parsed.category === "string" ? parsed.category : "",
      lockStyle: parsed.lockStyle === true,
      perTypeDesc: parsed.perTypeDesc && typeof parsed.perTypeDesc === "object" ? parsed.perTypeDesc : {},
      open: parsed.open !== false,
      ...(posterDraft(parsed.poster) ? { poster: posterDraft(parsed.poster) } : {}),
    };
  } catch {
    return null;
  }
}

export function writePackDraft(projectId: string, draft: PackDraft, storage?: Storage): void {
  const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (!target) return;
  try {
    target.setItem(packStorageKey(projectId), JSON.stringify(draft));
  } catch {
    // A full localStorage must not block generation.
  }
}

/**
 * Category only changes which recommended shots are selected.
 * The left-side selling points (`prompt`) and style stay as the caller passed them,
 * and per-type notes such as 商品卖点 are copied through unchanged.
 */
export function applyCategoryChange(input: {
  category: string;
  recommended: Record<string, readonly string[]>;
  prompt: string;
  style: string | null;
  perTypeDesc: Record<string, string>;
  currentSelected: readonly string[];
}): {
  selected: string[];
  prompt: string;
  style: string | null;
  perTypeDesc: Record<string, string>;
} {
  const recommended = input.category ? input.recommended[input.category] : undefined;
  const selected = recommended ? [...recommended] : [...input.currentSelected];
  return {
    selected: selected.length > 0 ? selected : [...GENERAL_PACK],
    prompt: input.prompt,
    style: input.style,
    perTypeDesc: { ...input.perTypeDesc },
  };
}
