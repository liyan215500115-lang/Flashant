/**
 * Homepage before/after slots. Every comparison pair is one physical SKU.
 * The Chanel slider pair is exclusive to the slider: Hero and StyleShowcase
 * must not reference those two paths.
 *
 * Tech debt: the material-tab before should be
 * `/marketing/v6/sku-b-before-closeup.webp` (bracelet/dial crop, distinct from
 * the hero full watch). That file is not in the tree, so this slot temporarily
 * reuses the hero watch source. Do not copy that reuse onto any other slot.
 */

export type HomepageSku = "watch" | "speaker" | "perfume";

export interface HomepagePair {
  sku: HomepageSku;
  before: string;
  after: string;
}

export interface HomepageStyleFrame extends HomepagePair {
  key: "material" | "lifestyle" | "scene";
  beforeAltKey: string;
  afterAltKey: string;
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

/** True while material before borrows the hero watch file. */
export const MATERIAL_BEFORE_REUSES_HERO = true;

export const HOMEPAGE_STYLE_FRAMES: readonly HomepageStyleFrame[] = [
  {
    key: "material",
    sku: "watch",
    before: "/marketing/v6/sku-b-omega-watch.webp",
    after: "/marketing/v6/sku-b-after-material.webp",
    beforeAltKey: "landing.styleShowcase.alts.skuB",
    afterAltKey: "landing.styleShowcase.alts.material",
  },
  {
    key: "lifestyle",
    sku: "speaker",
    before: "/marketing/v6/sku-c-bo-speaker.webp",
    after: "/marketing/v6/sku-c-after-lifestyle.webp",
    beforeAltKey: "landing.styleShowcase.alts.skuC",
    afterAltKey: "landing.styleShowcase.alts.lifestyle",
  },
  {
    key: "scene",
    sku: "perfume",
    before: "/marketing/v6/sku-a-showcase.webp",
    after: "/marketing/v6/after-scene.webp",
    beforeAltKey: "landing.styleShowcase.alts.skuA",
    afterAltKey: "landing.styleShowcase.alts.scene",
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
