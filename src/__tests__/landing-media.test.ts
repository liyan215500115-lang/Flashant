import { describe, expect, it } from "vitest";
import { buildStyleFrames, LANDING_MEDIA } from "@/lib/landing-media";

const PERFUME_STILLS = [
  "/marketing/v6/sku-a-bleu-chanel.webp",
  "/marketing/v6/sku-a-showcase.webp",
  "/marketing/v6/after-material.webp",
  "/marketing/v6/after-lifestyle.webp",
  "/marketing/v6/after-scene.webp",
  "/marketing/v6/hero-after-lifestyle.webp",
];

describe("homepage category mix", () => {
  it("keeps the comparison slider on the Chanel pair", () => {
    expect(LANDING_MEDIA.sliderBefore).toBe("/marketing/v6/slider-before-sku-a.webp");
    expect(LANDING_MEDIA.sliderAfter).toBe("/marketing/v6/slider-after-material.webp");
  });

  it("uses the watch and the speaker for the three looks, each as its own object", () => {
    const frames = buildStyleFrames({
      materialAlt: "watch",
      lifestyleAlt: "speaker",
      watchAlt: "watch again",
      speakerAlt: "speaker again",
      caption: "source",
    });

    expect(frames.material.map((frame) => frame.src)).toEqual([LANDING_MEDIA.watch]);
    expect(frames.lifestyle.map((frame) => frame.src)).toEqual([LANDING_MEDIA.speaker]);
    expect(frames.scene.map((frame) => frame.src)).toEqual([
      LANDING_MEDIA.watch,
      LANDING_MEDIA.speaker,
    ]);

    const slots = [...frames.material, ...frames.lifestyle, ...frames.scene];
    expect(new Set(slots).size).toBe(slots.length);
    for (const src of slots.map((frame) => frame.src)) {
      expect(PERFUME_STILLS).not.toContain(src);
    }
  });
});
