import { describe, it, expect } from "vitest";
import {
  getNextStatus,
  getEstimatedRemaining,
  getStageIndex,
  getTotalStages,
} from "@/lib/pipeline";

describe("Pipeline state machine", () => {
  it("getTotalStages returns 9 stages", () => {
    expect(getTotalStages()).toBe(9);
  });

  it("getStageIndex returns correct indices", () => {
    expect(getStageIndex("PARSING")).toBe(0);
    expect(getStageIndex("SCRIPTING")).toBe(1);
    expect(getStageIndex("GENERATING_IMAGES")).toBe(2);
    expect(getStageIndex("GENERATING_VIDEO")).toBe(3);
    expect(getStageIndex("GENERATING_AUDIO")).toBe(4);
    expect(getStageIndex("REVIEW")).toBe(5);
    expect(getStageIndex("APPROVED")).toBe(6);
    expect(getStageIndex("PUBLISHING")).toBe(7);
    expect(getStageIndex("PUBLISHED")).toBe(8);
  });

  it("getStageIndex returns -1 for FAILED", () => {
    expect(getStageIndex("FAILED")).toBe(-1);
  });

  it("getNextStatus returns correct next stage", () => {
    expect(getNextStatus("PARSING")).toBe("SCRIPTING");
    expect(getNextStatus("SCRIPTING")).toBe("GENERATING_IMAGES");
    expect(getNextStatus("GENERATING_IMAGES")).toBe("GENERATING_VIDEO");
    expect(getNextStatus("GENERATING_VIDEO")).toBe("GENERATING_AUDIO");
    expect(getNextStatus("GENERATING_AUDIO")).toBe("REVIEW");
    expect(getNextStatus("REVIEW")).toBe("APPROVED");
    expect(getNextStatus("APPROVED")).toBe("PUBLISHING");
    expect(getNextStatus("PUBLISHING")).toBe("PUBLISHED");
  });

  it("getNextStatus returns null for terminal stages", () => {
    expect(getNextStatus("PUBLISHED")).toBeNull();
    expect(getNextStatus("FAILED")).toBeNull();
  });

  it("getEstimatedRemaining returns cumulative time from current stage", () => {
    const remaining = getEstimatedRemaining("PARSING");
    expect(remaining).toBeGreaterThan(0);
    expect(getEstimatedRemaining("PUBLISHED")).toBe(0);
  });

  it("getEstimatedRemaining decreases as pipeline advances", () => {
    const atParsing = getEstimatedRemaining("PARSING");
    const atScripting = getEstimatedRemaining("SCRIPTING");
    const atImages = getEstimatedRemaining("GENERATING_IMAGES");
    expect(atScripting).toBeLessThan(atParsing);
    expect(atImages).toBeLessThan(atScripting);
  });
});
