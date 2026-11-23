import { describe, expect, it } from "vitest";
import { canvasImageFromViewedShot, shotBeingViewed, viewedShotFileUrl } from "@/lib/viewed-shot";

const canvas = {
  id: "old-lifestyle",
  url: "https://cdn.example/old-lifestyle.png",
  label: "使用场景",
};
const packShot = {
  id: "pack-multi",
  url: "https://cdn.example/multi-angle.png",
  label: "多角度",
};

describe("viewed shot download", () => {
  it("downloads the shot being looked at, not the stale canvas image", () => {
    const viewed = shotBeingViewed({ lightbox: packShot, canvas });
    expect(viewed?.id).toBe("pack-multi");
    expect(viewedShotFileUrl(viewed!)).toBe("/api/generated-images/pack-multi/file");
    expect(viewedShotFileUrl(viewed!)).not.toContain("old-lifestyle");
    expect(viewedShotFileUrl(viewed!)).not.toContain("cdn.example");

    expect(viewedShotFileUrl(canvas)).toBe("/api/generated-images/old-lifestyle/file");
    expect(shotBeingViewed({ lightbox: null, canvas })?.id).toBe("old-lifestyle");
  });

  it("promotes the pack tile onto the canvas", () => {
    expect(canvasImageFromViewedShot(packShot)).toEqual({
      id: "pack-multi",
      url: "https://cdn.example/multi-angle.png",
      promptUsed: "多角度",
    });
    expect(canvasImageFromViewedShot({ url: "", label: "多角度" })).toBeNull();
  });
});
