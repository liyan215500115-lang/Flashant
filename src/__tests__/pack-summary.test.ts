import { describe, expect, it } from "vitest";
import { LOCALE_OPTIONS } from "@/lib/locales";
import {
  formatPackCreditSummary,
  formatPackCreditSummaryFromPayload,
  packFailureReasonLabel,
} from "@/lib/generate/pack-summary";
import { NOT_STARTED_REASON } from "@/lib/generate/pack-timing";

const partial = {
  completed: 3,
  requested: 6,
  creditsCharged: 3,
  creditsRefunded: 1,
  notCharged: 2,
};

describe("pack credit summary", () => {
  it("states the charge, the refund, and the shots that were never debited", () => {
    const zh = formatPackCreditSummary({ ...partial, locale: "zh" });
    expect(zh).toBe("已完成 3/6，实际扣费 3 点额度。未成功 3 张：已退回 1 点额度，2 张未扣费");
    expect(zh).not.toBe("已完成 3/6，已退回 1 点额度");
    expect(zh).toContain("实际扣费 3");
    expect(zh).toContain("2 张未扣费");

    const en = formatPackCreditSummary({ ...partial, locale: "en" });
    expect(en).toBe("Completed 3/6, charged 3 credits. 3 failed: refunded 1, 2 not charged");
    expect(en).not.toContain("已退回");
  });

  it("does not mention a refund when every failure was never charged", () => {
    const zh = formatPackCreditSummary({
      completed: 3,
      requested: 6,
      creditsCharged: 3,
      creditsRefunded: 0,
      notCharged: 3,
      locale: "zh",
    });
    expect(zh).toBe("已完成 3/6，实际扣费 3 点额度。未成功 3 张：3 张未扣费");
    expect(zh).not.toContain("已退回");
  });

  it("counts a payload the way the studio summary does", () => {
    const text = formatPackCreditSummaryFromPayload({
      completed: 3,
      requested: 6,
      creditsCharged: 3,
      creditsRefunded: 1,
      creditsNotCharged: 2,
      failed: [
        { key: "flatlay", reason: "prediction_timeout", charged: true, creditsRefunded: true },
        { key: "color_variants", reason: "not_started", charged: false, creditsRefunded: false },
        { key: "lifestyle", reason: "not_started", charged: false, creditsRefunded: false },
      ],
    }, { requested: 6 }, "zh");
    expect(text).toContain("实际扣费 3 点额度");
    expect(text).toContain("已退回 1 点额度");
    expect(text).toContain("2 张未扣费");
    expect(text).not.toBe("已完成 3/6，已退回 1 点额度");
  });

  it("gives every supported locale a charged count and a not-charged count", () => {
    for (const { code } of LOCALE_OPTIONS) {
      const text = formatPackCreditSummary({ ...partial, locale: code });
      expect(text).toContain("3");
      expect(text).toContain("6");
      expect(text).toContain("1");
      expect(text).toContain("2");
      expect(text).not.toBe("已完成 3/6，已退回 1 点额度");
      expect(text.length).toBeGreaterThan(20);
    }
  });

  it("shows a plain not-started label in every locale and hides the raw code", () => {
    expect(packFailureReasonLabel(NOT_STARTED_REASON, "zh")).toBe("未开始生成");
    const labels = new Set<string>();
    for (const { code } of LOCALE_OPTIONS) {
      const label = packFailureReasonLabel(NOT_STARTED_REASON, code);
      const line = `flatlay 失败：${label}`;
      expect(label).not.toBe(NOT_STARTED_REASON);
      expect(label).not.toContain(NOT_STARTED_REASON);
      expect(line).not.toContain(NOT_STARTED_REASON);
      expect(label.length).toBeGreaterThan(0);
      labels.add(label);
    }
    expect(labels.size).toBe(LOCALE_OPTIONS.length);
    expect(packFailureReasonLabel("prediction_timeout", "zh")).toBe("prediction_timeout");
    expect(packFailureReasonLabel("provider exploded", "en")).toBe("provider exploded");
  });
});
