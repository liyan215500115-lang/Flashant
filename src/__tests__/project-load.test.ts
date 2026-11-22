import { describe, expect, it } from "vitest";
import { loadProjectWithRetry, shouldSurfaceProjectLoadError } from "@/lib/project-load";
import { isConfirmedQuotaPayload, loadConfirmedQuota } from "@/lib/quota-display";

describe("project fetch and quota after a refresh", () => {
  it("does not surface a load error when a transient empty response is followed by the project", async () => {
    let calls = 0;
    const loaded = await loadProjectWithRetry({
      hasVisibleProject: () => false,
      attempts: 3,
      sleep: async () => {},
      fetchProject: async () => {
        calls += 1;
        if (calls === 1) return null;
        if (calls === 2) throw new Error("Failed to fetch");
        return { id: "proj_1", title: "金色耳环" };
      },
    });
    expect(loaded).toEqual({ ok: true, project: { id: "proj_1", title: "金色耳环" } });
    expect(shouldSurfaceProjectLoadError({
      hasVisibleProject: true,
      failedAttempts: 3,
      maxAttempts: 3,
    })).toBe(false);
  });

  it("keeps a visible project when every retry fails", async () => {
    const loaded = await loadProjectWithRetry({
      hasVisibleProject: () => true,
      attempts: 2,
      sleep: async () => {},
      fetchProject: async () => {
        throw new Error("Failed to fetch");
      },
    });
    expect(loaded).toEqual({ ok: false, keepVisible: true });
  });

  it("does not treat an empty or failed quota payload as 0/0", async () => {
    expect(isConfirmedQuotaPayload(null)).toBe(false);
    expect(isConfirmedQuotaPayload({})).toBe(false);
    expect(isConfirmedQuotaPayload({ error: "Unauthorized" })).toBe(false);
    expect(isConfirmedQuotaPayload({
      used: 0,
      limit: 0,
      allowed: false,
      balance: 0,
      quotaKnown: false,
    })).toBe(false);
    expect(isConfirmedQuotaPayload({
      used: 4,
      limit: 100,
      allowed: true,
      balance: 96,
      tier: "PRO",
      allotmentConfigured: true,
    })).toBe(true);

    let calls = 0;
    const quota = await loadConfirmedQuota({
      attempts: 3,
      sleep: async () => {},
      fetchQuota: async () => {
        calls += 1;
        if (calls === 1) return { used: 0, limit: 0, allowed: false, balance: 0, quotaKnown: false };
        if (calls === 2) throw new Error("Failed to fetch");
        return { used: 2, limit: 100, allowed: true, balance: 98, tier: "PRO", allotmentConfigured: true };
      },
    });
    expect(quota).toMatchObject({ used: 2, limit: 100, tier: "PRO" });
    expect(`${quota?.used}/${quota?.limit}`).not.toBe("0/0");
  });
});
