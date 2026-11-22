export const GENERAL_PACK = ["selling_points", "detail", "multi_angle", "lifestyle"] as const;

const STORAGE_PREFIX = "flashant.studioPack.v1";

export interface PackDraft {
  selected: string[];
  category: string;
  lockStyle: boolean;
  perTypeDesc: Record<string, string>;
  open: boolean;
}

export function packStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}:${projectId}`;
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
