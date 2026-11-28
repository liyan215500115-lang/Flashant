import { isConfirmedQuotaPayload, loadConfirmedQuota, type QuotaSnapshot } from "@/lib/quota-display";

export type ProjectQuotaStatus = "loading" | "ready" | "error";

/** Numbers on an error row are not a balance. The badge must not render them. */
export interface ProjectQuotaState {
  status: ProjectQuotaStatus;
  used: number;
  limit: number;
  tier: string;
  allotmentConfigured: boolean;
}

export const PROJECT_QUOTA_LOADING: ProjectQuotaState = {
  status: "loading",
  used: 0,
  limit: 0,
  tier: "",
  allotmentConfigured: false,
};

export function projectQuotaFromPayload(data: unknown): ProjectQuotaState {
  if (!isConfirmedQuotaPayload(data)) {
    return {
      status: "error",
      used: 0,
      limit: 0,
      tier: "",
      allotmentConfigured: false,
    };
  }
  const quota: QuotaSnapshot = data;
  return {
    status: "ready",
    used: quota.used,
    limit: quota.limit,
    tier: typeof quota.tier === "string" ? quota.tier : "",
    allotmentConfigured: quota.allotmentConfigured === true,
  };
}

/**
 * A dropped request or a payload the wallet reader will not confirm
 * (401, quotaKnown false, 0/0 with allowed false) resolves to error.
 * It never resolves to a loading sentinel and never invents a balance.
 */
export async function loadProjectQuota(
  fetchQuota: () => Promise<unknown>,
  options?: { attempts?: number; sleep?: (ms: number) => Promise<void> },
): Promise<ProjectQuotaState> {
  try {
    const data = await loadConfirmedQuota({
      fetchQuota,
      attempts: options?.attempts,
      sleep: options?.sleep,
    });
    return projectQuotaFromPayload(data);
  } catch {
    return projectQuotaFromPayload(null);
  }
}
