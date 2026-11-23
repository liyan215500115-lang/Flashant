import { describe, expect, it } from "vitest";
import { SINGLE_IMAGE_RUN_MAX, singleImageRunExceedsCap } from "@/lib/generate/single-image-quantity";

describe("single-image run cap", () => {
  it("allows 1 through 8 and rejects a larger requested count", () => {
    expect(SINGLE_IMAGE_RUN_MAX).toBe(8);
    for (const count of [1, 4, 5, 8]) {
      expect(singleImageRunExceedsCap(count)).toBe(false);
    }
    expect(singleImageRunExceedsCap(8.1)).toBe(true);
    expect(singleImageRunExceedsCap(9)).toBe(true);
    expect(singleImageRunExceedsCap(undefined)).toBe(false);
    expect(singleImageRunExceedsCap("8")).toBe(false);
  });
});
