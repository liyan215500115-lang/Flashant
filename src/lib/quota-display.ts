import { GENERATION_ALLOTMENT, type GenerationTier } from "@/lib/creem/credits";

const FINITE_TIERS = new Set<GenerationTier>(["FREE", "PRO", "BUSINESS"]);

export interface QuotaSnapshot {
  used: number;
  limit: number;
  tier: string;
  allowed: boolean;
  balance: number;
  allotmentConfigured: boolean;
}

/**
 * Unlimited is a configured allotment, not a loading sentinel.
 * ENTERPRISE's -1 in GENERATION_ALLOTMENT means "no monthly amount configured",
 * so it is not shown as 无限. Free, Pro, and Business never are.
 */
export function quotaIsUnlimited(input: {
  tier?: string | null;
  limit: number;
  allotmentConfigured?: boolean;
}): boolean {
  if (!input.tier || FINITE_TIERS.has(input.tier as GenerationTier)) return false;
  return input.tier === "ENTERPRISE" && input.allotmentConfigured === true && input.limit < 0;
}

/**
 * A wallet read that failed comes back as 0/0 with allowed false.
 * That is not a confirmed empty balance. Free, Pro, and Business with a real
 * zero balance still have a positive monthly limit.
 */
export function isConfirmedQuotaPayload(data: unknown): data is QuotaSnapshot {
  if (!data || typeof data !== "object") return false;
  const row = data as Partial<QuotaSnapshot> & { quotaKnown?: boolean; allowed?: boolean };
  if (row.quotaKnown === false) return false;
  if (typeof row.used !== "number" || typeof row.limit !== "number") return false;
  if (!Number.isFinite(row.used) || !Number.isFinite(row.limit)) return false;
  if (row.used === 0 && row.limit === 0 && row.allowed === false) return false;
  return true;
}

/** True when the badge would show a different remaining balance. */
export function quotaSnapshotsDiffer(
  next: Pick<QuotaSnapshot, "used" | "limit" | "balance">,
  previous: Pick<QuotaSnapshot, "used" | "limit" | "balance">,
): boolean {
  if (next.used !== previous.used || next.limit !== previous.limit) return true;
  return Number.isFinite(next.balance) && Number.isFinite(previous.balance) && next.balance !== previous.balance;
}

/**
 * Refresh the workbench badge from a confirmed wallet read.
 * A failed read returns null and must not be shown as 0/0.
 * After a pack or single shot settles, pass the pre-generation snapshot as
 * `untilDiffersFrom`. The wallet often still reports that snapshot on the
 * first read, so keep reading until a confirmed snapshot differs or the
 * attempts run out. Failed reads are skipped, never applied as 0/0.
 */
export async function refreshWorkbenchQuota(options: {
  fetchQuota: () => Promise<unknown>;
  apply: (quota: QuotaSnapshot) => void;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  untilDiffersFrom?: QuotaSnapshot | null;
  intervalMs?: number;
}): Promise<QuotaSnapshot | null> {
  const previous = options.untilDiffersFrom ?? null;
  if (!previous) {
    const quota = await loadConfirmedQuota({
      fetchQuota: options.fetchQuota,
      attempts: options.attempts,
      sleep: options.sleep,
    });
    if (quota) options.apply(quota);
    return quota;
  }

  const attempts = options.attempts ?? 8;
  const intervalMs = options.intervalMs ?? 400;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastConfirmed: QuotaSnapshot | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const data = await options.fetchQuota();
      if (isConfirmedQuotaPayload(data)) {
        lastConfirmed = data;
        if (quotaSnapshotsDiffer(data, previous)) {
          options.apply(data);
          return data;
        }
      }
    } catch {
      // A dropped read is not a balance. Keep the last confirmed snapshot.
    }
    if (attempt < attempts - 1) await sleep(intervalMs);
  }
  if (lastConfirmed) {
    options.apply(lastConfirmed);
    return lastConfirmed;
  }
  return null;
}

export async function loadConfirmedQuota(options: {
  fetchQuota: () => Promise<unknown>;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<QuotaSnapshot | null> {
  const attempts = options.attempts ?? 3;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const data = await options.fetchQuota();
      if (isConfirmedQuotaPayload(data)) return data;
    } catch {
      // Retry. A dropped quota request must not become 0/0.
    }
    if (attempt < attempts - 1) await sleep(200);
  }
  return null;
}

export function presentQuota(quota: QuotaSnapshot): QuotaSnapshot & { unlimited: boolean } {
  const tier = quota.tier;
  const finite = FINITE_TIERS.has(tier as GenerationTier);
  let limit = quota.limit;
  if (finite && !(typeof limit === "number" && Number.isFinite(limit) && limit >= 0)) {
    limit = GENERATION_ALLOTMENT[tier as GenerationTier];
  }
  if (!finite && quota.allotmentConfigured !== true && !(typeof limit === "number" && Number.isFinite(limit) && limit >= 0)) {
    limit = Number.isFinite(quota.balance) && quota.balance > 0 ? quota.balance : 0;
  }
  const unlimited = quotaIsUnlimited({
    tier,
    limit: quota.allotmentConfigured === true ? quota.limit : limit,
    allotmentConfigured: quota.allotmentConfigured,
  });
  return {
    ...quota,
    limit: unlimited ? -1 : limit,
    unlimited,
  };
}

export function quotaBadgeText(
  input: {
    used: number;
    limit: number;
    tier?: string | null;
    allotmentConfigured?: boolean;
    loading?: boolean;
  },
  unlimitedLabel: string,
): string {
  const label = formatQuotaRemaining(input);
  if (label === "loading" || label.trim() === "") return "…";
  if (label === "unlimited") {
    const word = unlimitedLabel.trim();
    return word || "…";
  }
  return label;
}

/** "loading" and "unlimited" are sentinels. Anything else is a finite remaining/limit label. */
export function formatQuotaRemaining(input: {
  used: number;
  limit: number;
  tier?: string | null;
  allotmentConfigured?: boolean;
  loading?: boolean;
}): "loading" | "unlimited" | string {
  if (input.loading) return "loading";
  if (quotaIsUnlimited(input)) return "unlimited";
  const limit = Number.isFinite(input.limit) && input.limit > 0 ? Math.floor(input.limit) : 0;
  const used = Number.isFinite(input.used) && input.used > 0 ? Math.floor(input.used) : 0;
  return `${Math.max(0, limit - used)}/${limit}`;
}
