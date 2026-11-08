/** Homepage marketing stills. The comparison slider stays the Chanel pair. */

export const LANDING_MEDIA = {
  sliderBefore: "/marketing/v6/slider-before-sku-a.webp",
  sliderAfter: "/marketing/v6/slider-after-material.webp",
  watch: "/marketing/v6/sku-b-omega-watch.webp",
  speaker: "/marketing/v6/sku-c-bo-speaker.webp",
} as const;

export interface LandingFrame {
  src: string;
  alt: string;
  caption: string;
}

export interface StyleFrames {
  material: LandingFrame[];
  lifestyle: LandingFrame[];
  scene: LandingFrame[];
}

/**
 * One new object per slot. Material is the watch, lifestyle is the speaker,
 * scene shows both — so the active tab is a different product, not three
 * crops of the same bottle.
 */
export function buildStyleFrames(input: {
  materialAlt: string;
  lifestyleAlt: string;
  watchAlt: string;
  speakerAlt: string;
  caption: string;
}): StyleFrames {
  const shot = (src: string, alt: string): LandingFrame => ({
    src,
    alt,
    caption: input.caption,
  });

  return {
    material: [shot(LANDING_MEDIA.watch, input.materialAlt)],
    lifestyle: [shot(LANDING_MEDIA.speaker, input.lifestyleAlt)],
    scene: [
      shot(LANDING_MEDIA.watch, input.watchAlt),
      shot(LANDING_MEDIA.speaker, input.speakerAlt),
    ],
  };
}
