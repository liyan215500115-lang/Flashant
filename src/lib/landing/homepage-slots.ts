/**
 * Homepage image slots.
 *
 * Hero and the comparison slider stay one-SKU before/after pairs.
 * The Chanel slider pair is exclusive to the slider: Hero and StyleShowcase
 * must not reference those two paths.
 *
 * StyleShowcase (#styles) is twelve finished frames, four per tab, in
 * reading order. It is not a before/after comparison.
 */

export type HomepageSku = "watch" | "speaker" | "perfume";

export interface HomepagePair {
  sku: HomepageSku;
  before: string;
  after: string;
}

export type HomepageStyleKey = "material" | "lifestyle" | "scene";

export interface HomepageStyleImage {
  id: string;
  src: string;
  captionKey: string;
}

export interface HomepageStyleTab {
  key: HomepageStyleKey;
  images: readonly HomepageStyleImage[];
}

export const HOMEPAGE_HERO: HomepagePair = {
  sku: "watch",
  before: "/marketing/v6/sku-b-omega-watch.webp",
  after: "/marketing/v6/sku-b-hero-after.webp",
};

export const HOMEPAGE_HERO_ALT = {
  before: "landing.styleShowcase.alts.skuB",
  after: "landing.styleShowcase.alts.heroAfter",
} as const;

const styleImage = (id: string): HomepageStyleImage => ({
  id,
  src: `/marketing/styles/${id}.webp`,
  captionKey: `landing.styleShowcase.captions.${id}`,
});

export const HOMEPAGE_STYLE_FRAMES: readonly HomepageStyleTab[] = [
  {
    key: "material",
    images: [
      styleImage("material-1-leather-bucket"),
      styleImage("material-2-shino-bowl"),
      styleImage("material-3-ski-goggles"),
      styleImage("material-4-running-shoes"),
    ],
  },
  {
    key: "lifestyle",
    images: [
      styleImage("lifestyle-1-candle"),
      styleImage("lifestyle-2-lamp"),
      styleImage("lifestyle-3-headphones"),
      styleImage("lifestyle-4-espresso"),
    ],
  },
  {
    key: "scene",
    images: [
      styleImage("scene-1-road-bike"),
      styleImage("scene-2-skis"),
      styleImage("scene-3-skateboard"),
      styleImage("scene-4-hiking-pack"),
    ],
  },
];

export const HOMEPAGE_SLIDER: HomepagePair = {
  sku: "perfume",
  before: "/marketing/v6/slider-before-sku-a.webp",
  after: "/marketing/v6/slider-after-material.webp",
};

export const SLIDER_EXCLUSIVE_PATHS = [
  HOMEPAGE_SLIDER.before,
  HOMEPAGE_SLIDER.after,
] as const;
