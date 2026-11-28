import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { quotaBadgeText } from "@/lib/quota-display";
import { loadProjectQuota, projectQuotaFromPayload } from "@/lib/project-quota";

const quiet = async () => {};

describe("project page quota", () => {
  it("shows a confirmed remaining balance and leaves the loading sentinel", async () => {
    const state = await loadProjectQuota(async () => ({
      used: 4,
      limit: 100,
      allowed: true,
      balance: 96,
      tier: "PRO",
      allotmentConfigured: true,
      quotaKnown: true,
    }), { sleep: quiet });
    expect(state.status).toBe("ready");
    expect(quotaBadgeText({ ...state, loading: false }, "无限")).toBe("96/100");
    expect(quotaBadgeText({ ...state, loading: false }, "无限")).not.toBe("…");
  });

  it("ends loading on a failed request or an unrecognized payload without becoming 0/0 or unlimited", async () => {
    const fetches = [
      async () => {
        throw new Error("quota");
      },
      async () => ({ error: "Unauthorized" }),
      async () => ({ used: 0, limit: 0, allowed: false, balance: 0, quotaKnown: false, tier: "PRO" }),
      async () => null,
    ];
    for (const fetchQuota of fetches) {
      const state = await loadProjectQuota(fetchQuota, { attempts: 1, sleep: quiet });
      expect(state.status).toBe("error");
      expect(state.status).not.toBe("loading");
      const mistaken = quotaBadgeText({
        used: state.used,
        limit: state.limit,
        tier: state.tier,
        allotmentConfigured: state.allotmentConfigured,
        loading: false,
      }, "无限");
      expect(mistaken).toBe("0/0");
      expect(projectQuotaFromPayload(await fetchQuota().catch(() => null)).status).toBe("error");
    }
  });

  it("keeps failure and retry copy in every locale catalog", () => {
    const dir = path.resolve(__dirname, "../../messages");
    const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
    expect(files.length).toBeGreaterThan(1);
    for (const name of files) {
      const messages = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as {
        detail?: { quotaUnavailable?: string; quotaRetry?: string };
      };
      expect(messages.detail?.quotaUnavailable, name).toBeTruthy();
      expect(messages.detail?.quotaRetry, name).toBeTruthy();
      expect(messages.detail?.quotaUnavailable).not.toBe("detail.quotaUnavailable");
      expect(messages.detail?.quotaRetry).not.toMatch(/0\/0|无限|unlimited/i);
    }
  });
});
