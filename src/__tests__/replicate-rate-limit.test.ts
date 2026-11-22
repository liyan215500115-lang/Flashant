import { describe, expect, it } from "vitest";
import { isReplicateRateLimit, replicateRetryDelayMs } from "@/lib/generate/replicate-rate-limit";

describe("replicate 429 retry_after", () => {
  it("reads retry_after seconds from the provider error", () => {
    const error = new Error(
      'Replicate API error: 429 {"detail":"balance under $5, burst 1","retry_after":2}',
    );
    expect(isReplicateRateLimit(error)).toBe(true);
    expect(replicateRetryDelayMs(error)).toBe(2_000);
    expect(replicateRetryDelayMs(new Error("Replicate API error: 429 rate limited retry_after=3"))).toBe(3_000);
  });

  it("does not treat other provider errors as a rate limit", () => {
    expect(replicateRetryDelayMs(new Error("Replicate API error: 500 {\"error\":\"down\"}"))).toBeNull();
    expect(isReplicateRateLimit(new Error("E005"))).toBe(false);
  });
});