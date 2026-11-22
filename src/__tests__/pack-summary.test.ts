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
    expect(packFailureReasonLabel("prediction_timeout", "zh")).not.toContain("prediction_timeout");
    expect(packFailureReasonLabel("provider exploded", "en")).toBe("provider exploded");
  });

  it("labels the project page failure list and hides not_started", () => {
    const stored = ["not_started", "prediction_timeout", ""];
    const shown = stored.map((message) => packFailureReasonLabel(message || "生成失败", "zh"));
    expect(shown[0]).toBe("未开始生成");
    expect(shown[1]).toBe("生成超时，请重试");
    expect(shown[2]).toBe("生成失败");
    expect(shown.join(" ")).not.toContain("not_started");
    expect(shown.join(" ")).not.toContain("prediction_timeout");
    expect(packFailureReasonLabel("not_started", "en")).toBe("Not started");
  });

  it("maps rate limits, safety flags, and timeouts to plain language in every locale", () => {
    const rateLimit = 'Replicate API error: 429 {"detail":"Request was throttled. Your credit balance is under $5 so the rate limit dropped to 6/min with burst 1.","retry_after":2}';
    const safety = "The input or output was flagged as sensitive. (E005) (uIJ6l3ruRD)";
    const timeout = "prediction_timeout";
    const rawCodes = ["429", "E005", "prediction_timeout", "retry_after", "Replicate", "{"];

    expect(packFailureReasonLabel(rateLimit, "zh")).toBe("图像服务繁忙，请稍后再试");
    expect(packFailureReasonLabel(safety, "zh")).toBe("内容未通过安全检查");
    expect(packFailureReasonLabel(timeout, "zh")).toBe("生成超时，请重试");
    expect(packFailureReasonLabel(packFailureReasonLabel(rateLimit, "zh"), "zh")).toBe("图像服务繁忙，请稍后再试");

    for (const { code } of LOCALE_OPTIONS) {
      for (const raw of [rateLimit, safety, timeout]) {
        const label = packFailureReasonLabel(raw, code);
        expect(label.length).toBeGreaterThan(4);
        for (const secret of rawCodes) {
          expect(label).not.toContain(secret);
        }
        expect(packFailureReasonLabel(label, code)).toBe(label);
      }
    }

    const blob = packFailureReasonLabel('{"error":"upstream exploded","prediction":"abc"}', "en");
    expect(blob).toBe("Generation failed. Please try again.");
    expect(blob).not.toContain("{");
    expect(packFailureReasonLabel("not_started", "zh")).toBe("未开始生成");
  });
});
