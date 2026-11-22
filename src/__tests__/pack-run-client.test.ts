import { describe, expect, it } from "vitest";
import { isPackRequestDisconnect, pollPackUntilSettled } from "@/lib/generate/pack-run-client";

const startedAt = 1_700_000_000_000;

function credit(finishedAt: number, completed = 1) {
  return {
    id: "pack_run",
    finishedAt: new Date(finishedAt).toISOString(),
    requested: 6,
    completed,
    creditsCharged: completed,
    creditsRefunded: 5,
    creditsNotCharged: 0,
    failed: [
      {
        key: "detail",
        reason: "The input or output was flagged as sensitive. (E005) (uIJ6l3ruRD)",
        charged: true,
        creditsRefunded: true,
      },
      {
        key: "flatlay",
        reason: 'Replicate API error: 429 {"detail":"balance under $5","retry_after":2}',
        charged: true,
        creditsRefunded: true,
      },
      {
        key: "multi_angle",
        reason: "prediction_timeout",
        charged: true,
        creditsRefunded: true,
      },
    ],
  };
}

describe("pack run recovery after a dropped generate POST", () => {
  it("treats Failed to fetch as a disconnect, not a finished failure", () => {
    expect(isPackRequestDisconnect(new TypeError("Failed to fetch"))).toBe(true);
    expect(isPackRequestDisconnect(new Error("net::ERR_CONNECTION_CLOSED"))).toBe(true);
    expect(isPackRequestDisconnect(new DOMException("The operation was aborted", "AbortError"))).toBe(true);
    expect(isPackRequestDisconnect(new Error("insufficient_credits"))).toBe(false);
  });

  it("polls until the project is terminal and shows the persisted credit summary", async () => {
    let step = 0;
    const view = await pollPackUntilSettled({
      startedAt,
      locale: "zh",
      intervalMs: 1,
      maxSteps: 6,
      now: () => startedAt + step * 1_000,
      sleep: async () => {
        step += 1;
      },
      fetchProject: async () => {
        if (step < 2) {
          return {
            status: "GENERATING",
            generatedImages: [{
              status: "FAILED",
              url: "",
              generationMeta: {
                sourceType: "detail",
                detailKey: "lifestyle",
                packId: "older",
                packCredit: credit(startedAt - 60_000, 0),
              },
            }],
          };
        }
        return {
          status: "GENERATED",
          generatedImages: [{
            status: "SUCCEEDED",
            url: "https://cdn.example/lifestyle.png",
            generationMeta: {
              sourceType: "detail",
              detailKey: "lifestyle",
              packId: "pack_run",
              packCredit: credit(startedAt + 5_000, 1),
            },
          }],
        };
      },
    });

    expect(view).not.toBeNull();
    expect(view?.summary).toContain("已完成 1/6");
    expect(view?.summary).toContain("实际扣费 1");
    expect(view?.summary).toContain("已退回 5");
    expect(view?.successes).toEqual([
      expect.objectContaining({ key: "lifestyle", url: "https://cdn.example/lifestyle.png" }),
    ]);
    const reasons = view?.failures.map((failure) => failure.reason).join(" ") ?? "";
    expect(reasons).not.toContain("E005");
    expect(reasons).not.toContain("429");
    expect(reasons).not.toContain("prediction_timeout");
    expect(reasons).not.toContain("{");
    expect(reasons).toContain("安全");
    expect(reasons).toContain("繁忙");
    expect(reasons).toContain("超时");
  });

  it("does not present an older finished pack as this disconnected order", async () => {
    let polls = 0;
    const view = await pollPackUntilSettled({
      startedAt,
      locale: "en",
      intervalMs: 1,
      maxSteps: 5,
      now: () => startedAt,
      sleep: async () => {
        polls += 1;
      },
      fetchProject: async () => ({
        status: "GENERATED",
        generatedImages: [{
          status: "SUCCEEDED",
          url: "https://cdn.example/old.png",
          generationMeta: {
            packId: "old",
            detailKey: "lifestyle",
            packCredit: credit(startedAt - 120_000, 6),
          },
        }],
      }),
    });
    expect(view).toBeNull();
    expect(polls).toBeGreaterThan(0);
  });
});
