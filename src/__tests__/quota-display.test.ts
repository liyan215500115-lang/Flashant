import { describe, expect, it, vi } from "vitest";
import { formatQuotaRemaining, presentQuota, quotaBadgeText, refreshWorkbenchQuota } from "@/lib/quota-display";

describe("quota display", () => {
  it("does not show unlimited for a finite wallet, a zero balance, or a loading sentinel", () => {
    for (const tier of ["FREE", "PRO", "BUSINESS"] as const) {
      expect(formatQuotaRemaining({
        used: 7,
        limit: -1,
        tier,
        allotmentConfigured: true,
      })).not.toBe("unlimited");
      expect(formatQuotaRemaining({
        used: 0,
        limit: Infinity,
        tier,
        allotmentConfigured: true,
      })).not.toBe("unlimited");
      expect(formatQuotaRemaining({
        used: 0,
        limit: 0,
        tier,
        allotmentConfigured: true,
      })).toBe("0/0");
    }
    expect(formatQuotaRemaining({
      used: 0,
      limit: -1,
      tier: "PRO",
      loading: true,
    })).toBe("loading");
    expect(presentQuota({
      used: 7,
      limit: -1,
      tier: "PRO",
      allowed: true,
      balance: 93,
      allotmentConfigured: true,
    })).toMatchObject({ limit: 100, unlimited: false, tier: "PRO" });
  });

  it("shows unlimited for enterprise only when that allotment is actually configured", () => {
    const unconfigured = presentQuota({
      used: 0,
      limit: -1,
      tier: "ENTERPRISE",
      allowed: true,
      balance: 12,
      allotmentConfigured: false,
    });
    expect(unconfigured.unlimited).toBe(false);
    expect(unconfigured.limit).toBe(12);
    expect(formatQuotaRemaining(unconfigured)).toBe("12/12");

    const configured = presentQuota({
      used: 0,
      limit: -1,
      tier: "ENTERPRISE",
      allowed: true,
      balance: 12,
      allotmentConfigured: true,
    });
    expect(configured.unlimited).toBe(true);
    expect(formatQuotaRemaining({ ...configured, used: 0 })).toBe("unlimited");
  });

  it("keeps the loading badge as an ellipsis, never blank and never 无限", () => {
    const loading = {
      used: 0,
      limit: -1,
      tier: "PRO",
      allotmentConfigured: true,
      loading: true,
    };
    expect(quotaBadgeText(loading, "无限")).toBe("…");
    expect(quotaBadgeText(loading, "无限")).not.toBe("");
    expect(quotaBadgeText(loading, "无限")).not.toBe("无限");
    expect(quotaBadgeText({
      used: 0,
      limit: -1,
      tier: "ENTERPRISE",
      allotmentConfigured: true,
      loading: true,
    }, "无限")).toBe("…");
    expect(quotaBadgeText({
      used: 7,
      limit: 100,
      tier: "PRO",
      allotmentConfigured: true,
      loading: false,
    }, "无限")).toBe("93/100");
  });
});

describe("GET /api/quota", () => {
  it("never returns an unlimited sentinel for a finite tier", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user_pro" } })),
    }));
    vi.doMock("@/lib/lemonsqueezy/billing", () => ({
      checkGenerationQuota: vi.fn(async () => ({
        allowed: true,
        used: 7,
        limit: -1,
        tier: "PRO",
        balance: 93,
        allotmentConfigured: true,
      })),
    }));
    const { GET } = await import("@/app/api/quota/route");
    const res = await GET();
    const json = await res.json();
    expect(json.tier).toBe("PRO");
    expect(json.unlimited).toBe(false);
    expect(json.limit).toBeGreaterThan(0);
    expect(json.limit).not.toBe(-1);
  });
});

describe("refreshWorkbenchQuota", () => {
  it("does not apply a failed wallet read as 0/0", async () => {
    const apply = vi.fn();
    const missed = await refreshWorkbenchQuota({
      fetchQuota: async () => ({ used: 0, limit: 0, allowed: false, tier: "PRO", balance: 0, allotmentConfigured: true }),
      apply,
      sleep: async () => {},
    });
    expect(missed).toBeNull();
    expect(apply).not.toHaveBeenCalled();

    const applied = await refreshWorkbenchQuota({
      fetchQuota: async () => ({ used: 21, limit: 100, allowed: true, tier: "PRO", balance: 79, allotmentConfigured: true }),
      apply,
      sleep: async () => {},
    });
    expect(applied?.used).toBe(21);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0]).toMatchObject({ used: 21, limit: 100 });
  });
});
