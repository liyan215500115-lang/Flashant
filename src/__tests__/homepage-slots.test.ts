import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createT, getMessages } from "@/lib/messages";
import { LOCALE_OPTIONS } from "@/lib/locales";
import {
  HOMEPAGE_HERO,
  HOMEPAGE_HERO_ALT,
  HOMEPAGE_SLIDER,
  HOMEPAGE_STYLE_FRAMES,
  MATERIAL_BEFORE_REUSES_HERO,
  SLIDER_EXCLUSIVE_PATHS,
  type HomepagePair,
} from "@/lib/landing/homepage-slots";

const ROOT = path.resolve(__dirname, "../..");

function publicFile(urlPath: string) {
  return path.join(ROOT, "public", urlPath.replace(/^\//, ""));
}

function pairPaths(pair: HomepagePair) {
  return [pair.before, pair.after];
}

describe("homepage same-SKU slots", () => {
  const frames = HOMEPAGE_STYLE_FRAMES;
  const heroAndFrames = [HOMEPAGE_HERO.before, HOMEPAGE_HERO.after, ...frames.flatMap(pairPaths)];

  it("keeps every comparison pair on one SKU", () => {
    expect(HOMEPAGE_HERO.before).not.toBe(HOMEPAGE_HERO.after);
    expect(HOMEPAGE_HERO.sku).toBe("watch");
    expect(HOMEPAGE_SLIDER.sku).toBe("perfume");
    expect(HOMEPAGE_SLIDER.before).not.toBe(HOMEPAGE_SLIDER.after);

    for (const frame of frames) {
      expect(frame.before).not.toBe(frame.after);
      expect(frame.before.endsWith(".webp")).toBe(true);
      expect(frame.after.endsWith(".webp")).toBe(true);
    }

    expect(frames.map((frame) => frame.sku)).toEqual(["watch", "speaker", "perfume"]);
    expect(new Set([HOMEPAGE_HERO.sku, ...frames.map((frame) => frame.sku)])).toEqual(
      new Set(["watch", "speaker", "perfume"])
    );
  });

  it("keeps the Chanel slider pair off Hero and StyleShowcase", () => {
    for (const sliderPath of SLIDER_EXCLUSIVE_PATHS) {
      expect(heroAndFrames).not.toContain(sliderPath);
    }
    expect(SLIDER_EXCLUSIVE_PATHS).toEqual([
      "/marketing/v6/slider-before-sku-a.webp",
      "/marketing/v6/slider-after-material.webp",
    ]);
  });

  it("reuses a file across main slots only for the missing watch closeup", () => {
    expect(MATERIAL_BEFORE_REUSES_HERO).toBe(true);
    expect(existsSync(publicFile("/marketing/v6/sku-b-before-closeup.webp"))).toBe(false);

    const material = frames.find((frame) => frame.key === "material");
    expect(material?.before).toBe(HOMEPAGE_HERO.before);
    expect(material?.sku).toBe(HOMEPAGE_HERO.sku);

    const counted = new Map<string, number>();
    for (const src of [...heroAndFrames, ...pairPaths(HOMEPAGE_SLIDER)]) {
      counted.set(src, (counted.get(src) ?? 0) + 1);
    }
    const reused = [...counted.entries()].filter(([, count]) => count > 1);
    expect(reused).toEqual([[HOMEPAGE_HERO.before, 2]]);
  });

  it("points every slot at a file that exists", () => {
    const paths = [...heroAndFrames, ...pairPaths(HOMEPAGE_SLIDER)];
    for (const src of paths) {
      expect(existsSync(publicFile(src)), src).toBe(true);
    }
  });

  it("resolves same-SKU copy in every locale", () => {
    for (const { code } of LOCALE_OPTIONS) {
      const t = createT(getMessages(code));
      expect(t("landing.heroCards.footnote")).not.toBe("landing.heroCards.footnote");
      expect(t("landing.heroCards.before")).not.toBe("landing.heroCards.before");
      expect(t("landing.heroCards.after")).not.toBe("landing.heroCards.after");
      expect(t(HOMEPAGE_HERO_ALT.before)).not.toBe(HOMEPAGE_HERO_ALT.before);
      expect(t(HOMEPAGE_HERO_ALT.after)).not.toBe(HOMEPAGE_HERO_ALT.after);
      for (const frame of frames) {
        expect(t(`landing.styleShowcase.tooltips.${frame.key}`)).not.toBe(
          `landing.styleShowcase.tooltips.${frame.key}`
        );
        expect(t(`landing.styleShowcase.captions.${frame.key}`)).not.toBe(
          `landing.styleShowcase.captions.${frame.key}`
        );
        expect(t(frame.beforeAltKey)).not.toBe(frame.beforeAltKey);
        expect(t(frame.afterAltKey)).not.toBe(frame.afterAltKey);
      }
    }

    const en = createT(getMessages("en"));
    const zh = createT(getMessages("zh"));
    expect(en("landing.heroCards.footnote").toLowerCase()).toContain("watch");
    expect(en("landing.heroCards.before")).toBe("Before");
    expect(en("landing.heroCards.after")).toBe("After");
    expect(zh("landing.heroCards.footnote")).toContain("腕表");
    expect(zh("landing.heroCards.before")).toBe("原图");
    expect(zh("landing.heroCards.after")).toBe("成片");
    expect(en("landing.styleShowcase.tooltips.material").toLowerCase()).not.toContain("bottle");
    expect(en("landing.styleShowcase.tooltips.lifestyle").toLowerCase()).not.toContain("bottle");
    expect(en("landing.styleShowcase.tabs.material").toLowerCase()).toContain("watch");
    expect(en("landing.styleShowcase.tabs.lifestyle").toLowerCase()).toContain("speaker");
    expect(en("landing.styleShowcase.tabs.scene").toLowerCase()).toContain("perfume");
    expect(zh("landing.styleShowcase.tabs.material")).toContain("腕表");
    expect(zh("landing.styleShowcase.tabs.lifestyle")).toContain("音箱");
    expect(zh("landing.styleShowcase.tabs.scene")).toContain("香水");
    expect(en("landing.styleShowcase.captions.material").toLowerCase()).toContain("steel");
    expect(en("landing.styleShowcase.captions.lifestyle").toLowerCase()).toContain("leather");
    expect(en("landing.styleShowcase.captions.scene").toLowerCase()).toContain("bottle");
    expect(zh("landing.styleShowcase.captions.material")).toContain("钢");
    expect(zh("landing.styleShowcase.captions.lifestyle")).toContain("网罩");
    expect(zh("landing.styleShowcase.captions.scene")).toContain("瓶");
    expect(zh("landing.styleShowcase.tooltips.material")).not.toContain("瓶");
    expect(zh("landing.styleShowcase.tooltips.lifestyle")).not.toContain("瓶");
  });
});
