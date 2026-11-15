import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createT, getMessages } from "@/lib/messages";
import { LOCALE_OPTIONS } from "@/lib/locales";
import {
  HOMEPAGE_HERO,
  HOMEPAGE_HERO_ALT,
  HOMEPAGE_SLIDER,
  HOMEPAGE_STYLE_FRAMES,
  SLIDER_EXCLUSIVE_PATHS,
  type HomepagePair,
} from "@/lib/landing/homepage-slots";
import * as homepageSlots from "@/lib/landing/homepage-slots";

const ROOT = path.resolve(__dirname, "../..");

const HERO_SLIDER_PATHS = [
  "/marketing/v6/sku-b-omega-watch.webp",
  "/marketing/v6/sku-b-hero-after.webp",
  "/marketing/v6/slider-before-sku-a.webp",
  "/marketing/v6/slider-after-material.webp",
] as const;

const STYLE_IDS = [
  "material-1-leather-bucket",
  "material-2-shino-bowl",
  "material-3-ski-goggles",
  "material-4-running-shoes",
  "lifestyle-1-candle",
  "lifestyle-2-lamp",
  "lifestyle-3-headphones",
  "lifestyle-4-espresso",
  "scene-1-road-bike",
  "scene-2-skis",
  "scene-3-skateboard",
  "scene-4-hiking-pack",
] as const;

/** SHA-256 of the bytes shipped in the selection zips. */
const STYLE_SHA256: Record<string, string> = {
  "lifestyle-1-candle.png": "000df08df8494a266e11af84c63baf4631165422577020d1adc51ae8739d200d",
  "lifestyle-1-candle.webp": "d631e77e1c67cf93aec53314ef84c899f3b13d77d00f91b88d092a7e6b8be6ff",
  "lifestyle-2-lamp.png": "cc4098fbd967cc2b4ffbd0233ee2f0f3b196fd811d7e9ad4fae343f672920292",
  "lifestyle-2-lamp.webp": "31a81578b6b1e4b3deea20f00cc17025f41827a90c68247cb490d52cb546f863",
  "lifestyle-3-headphones.png": "fef77c5a15d850535310b85ed5287e29fc93c434bb12fef6ef5a4dcd87513f44",
  "lifestyle-3-headphones.webp": "d3c28996d06a7c62b0f8a7e826aadd1b5f82b5a7c1687e51e66edc17fed087d1",
  "lifestyle-4-espresso.png": "c40bc894eaeaf4f6003e2a03b075847e1432c708833bf05205db6b664bd2ebff",
  "lifestyle-4-espresso.webp": "78b0f3dd471a983fcd79f4c76e8bb3e7d4715433b4b6c549595e4cd0ae106866",
  "material-1-leather-bucket.png": "cb9729fa687c9a06beb747a9dc4c45e50a17f1c62c41baf76e9d3029900e7e25",
  "material-1-leather-bucket.webp": "b73d4ea6b1fc6c85d48aa9fa4ea6afd904e1fdcffe15218f90cdf9ce127b13b7",
  "material-2-shino-bowl.png": "cef05de3079601ea08eba7aaedb739fb007aee53edccb73c5eae728e993cee6d",
  "material-2-shino-bowl.webp": "ceb4cb64280023f9d114b04d055ceb4e7b39a9026ac46e574fb74959d7c93a03",
  "material-3-ski-goggles.png": "5963985bb36dbf01a665e39b6fbbac13b8a4c0d980086912d23fda79c61dddea",
  "material-3-ski-goggles.webp": "99ee85d684a5285ddaf41ac1deecf9e5cdbbe3a3726665cf9f24ebffb062dd3a",
  "material-4-running-shoes.png": "42f73fcb4e21a588db0b40ffcd97f9aaced3a65d4a4bfa16c810001c19d13157",
  "material-4-running-shoes.webp": "82796b28feb0992adbad4b51c8ee220225f188d413a4740daa7c409efa89aada",
  "scene-1-road-bike.png": "a0852c9a5b59365d212b9c41f83f61d35d1f4cca13ceec63a0e30c5da75f7592",
  "scene-1-road-bike.webp": "679b46302079525c587b17efd505e1820ad986f4cedf300d4a32d581828bc3db",
  "scene-2-skis.png": "ce9ffd5e6ca5e79e3e93a7f5c8ff49b46d71a768d2631b301fda40e178bf1d6c",
  "scene-2-skis.webp": "5e0db93c1237a5848f54bdc294772484a380735a7713f3c3eeb68c9bd19d0057",
  "scene-3-skateboard.png": "b1a4a836d04d371b75946080af3577332dd9bc9e197180a8036220e396c70244",
  "scene-3-skateboard.webp": "9373b06d601d5f5f5b12905c7d8d59999ea4ba30d3703724d312813f060b1095",
  "scene-4-hiking-pack.png": "9962af1f7eb63c18a13a410ccde164ee00eccdd81137500245d0b13de3409e72",
  "scene-4-hiking-pack.webp": "0285f2924a0ea1d0bff892d07c450f502b9a8a24ea948c10903601175d8c31c5",
};

const EN_CAPTIONS: Record<(typeof STYLE_IDS)[number], string> = {
  "material-1-leather-bucket": "Vegetable-tanned bucket bag",
  "material-2-shino-bowl": "Shino bowl",
  "material-3-ski-goggles": "Ski goggles",
  "material-4-running-shoes": "Running shoes",
  "lifestyle-1-candle": "Scented candle",
  "lifestyle-2-lamp": "Table lamp",
  "lifestyle-3-headphones": "Headphones",
  "lifestyle-4-espresso": "Espresso machine",
  "scene-1-road-bike": "Road bike",
  "scene-2-skis": "Skis",
  "scene-3-skateboard": "Skateboard",
  "scene-4-hiking-pack": "Hiking pack",
};

const ZH_CAPTIONS: Record<(typeof STYLE_IDS)[number], string> = {
  "material-1-leather-bucket": "植鞣桶包",
  "material-2-shino-bowl": "志野碗",
  "material-3-ski-goggles": "雪镜",
  "material-4-running-shoes": "跑鞋",
  "lifestyle-1-candle": "香薰蜡烛",
  "lifestyle-2-lamp": "台灯",
  "lifestyle-3-headphones": "耳机",
  "lifestyle-4-espresso": "咖啡机",
  "scene-1-road-bike": "公路车",
  "scene-2-skis": "滑雪板",
  "scene-3-skateboard": "滑板",
  "scene-4-hiking-pack": "登山包",
};

const STALE_STYLE_COPY = [
  "steel",
  "bracelet",
  "bottle",
  "mesh",
  "watch",
  "speaker",
  "perfume",
  "before and after",
  "钢",
  "网罩",
  "瓶",
  "腕表",
  "音箱",
  "香水",
  "原图",
  "同一",
];

function publicFile(urlPath: string) {
  return path.join(ROOT, "public", urlPath.replace(/^\//, ""));
}

function pairPaths(pair: HomepagePair) {
  return [pair.before, pair.after];
}

function imageSize(filePath: string): { width: number; height: number } {
  const bytes = readFileSync(filePath);
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    const chunk = bytes.subarray(12, 16).toString("ascii");
    if (chunk === "VP8 " && bytes.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
  }
  throw new Error(`unsupported image: ${filePath}`);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe("homepage slots", () => {
  const frames = HOMEPAGE_STYLE_FRAMES;
  const styleSrcs = frames.flatMap((tab) => tab.images.map((image) => image.src));

  it("keeps Hero and the slider as same-SKU comparison pairs", () => {
    expect(HOMEPAGE_HERO).toEqual({
      sku: "watch",
      before: "/marketing/v6/sku-b-omega-watch.webp",
      after: "/marketing/v6/sku-b-hero-after.webp",
    });
    expect(HOMEPAGE_SLIDER).toEqual({
      sku: "perfume",
      before: "/marketing/v6/slider-before-sku-a.webp",
      after: "/marketing/v6/slider-after-material.webp",
    });
    expect(HOMEPAGE_HERO.before).not.toBe(HOMEPAGE_HERO.after);
    expect(HOMEPAGE_SLIDER.before).not.toBe(HOMEPAGE_SLIDER.after);
    expect(HOMEPAGE_HERO_ALT).toEqual({
      before: "landing.styleShowcase.alts.skuB",
      after: "landing.styleShowcase.alts.heroAfter",
    });
  });

  it("keeps the Chanel slider pair off Hero and StyleShowcase", () => {
    const heroAndStyles = [HOMEPAGE_HERO.before, HOMEPAGE_HERO.after, ...styleSrcs];
    for (const sliderPath of SLIDER_EXCLUSIVE_PATHS) {
      expect(heroAndStyles).not.toContain(sliderPath);
    }
    expect(SLIDER_EXCLUSIVE_PATHS).toEqual([
      "/marketing/v6/slider-before-sku-a.webp",
      "/marketing/v6/slider-after-material.webp",
    ]);
  });

  it("shows four finished frames per tab and does not reuse the hero watch", () => {
    expect("MATERIAL_BEFORE_REUSES_HERO" in homepageSlots).toBe(false);
    expect(frames.map((tab) => tab.key)).toEqual(["material", "lifestyle", "scene"]);
    expect(styleSrcs).toEqual(STYLE_IDS.map((id) => `/marketing/styles/${id}.webp`));
    for (const src of styleSrcs) {
      expect(src.startsWith("/marketing/styles/")).toBe(true);
      expect(src.includes("/marketing/v6/")).toBe(false);
      expect(HERO_SLIDER_PATHS).not.toContain(src);
    }
    expect(new Set(styleSrcs).size).toBe(12);
    const shared = styleSrcs.filter((src) => pairPaths(HOMEPAGE_HERO).includes(src) || pairPaths(HOMEPAGE_SLIDER).includes(src));
    expect(shared).toEqual([]);
  });

  it("commits the twelve frames as webp and png, and references only the webp from #styles", () => {
    const referenced = new Set(styleSrcs);
    for (const id of STYLE_IDS) {
      const webp = `/marketing/styles/${id}.webp`;
      const png = `/marketing/styles/${id}.png`;
      expect(referenced.has(webp)).toBe(true);
      for (const urlPath of [webp, png]) {
        const filePath = publicFile(urlPath);
        const bytes = readFileSync(filePath);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(STYLE_SHA256[`${id}${path.extname(urlPath)}`]);
        expect(imageSize(filePath)).toEqual({ width: 1600, height: 1200 });
      }
    }

    const hits: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      const text = readFileSync(file, "utf8");
      if (text.includes("/marketing/styles/")) hits.push(path.relative(ROOT, file));
    }
    expect(hits).toEqual(["src/lib/landing/homepage-slots.ts"]);

    for (const protectedPath of HERO_SLIDER_PATHS) {
      expect(statSync(publicFile(protectedPath)).isFile()).toBe(true);
    }
  });

  it("names each finished frame in every locale and drops the old product captions", () => {
    for (const { code } of LOCALE_OPTIONS) {
      const t = createT(getMessages(code));
      expect(t("landing.styleShowcase.subtitle")).not.toBe("landing.styleShowcase.subtitle");
      expect(t("landing.styleShowcase.outputCaption")).toBe("landing.styleShowcase.outputCaption");
      expect(t("landing.styleShowcase.sourceCaption")).toBe("landing.styleShowcase.sourceCaption");
      expect(t("landing.styleShowcase.captions.material")).toBe("landing.styleShowcase.captions.material");
      expect(t("landing.styleShowcase.captions.lifestyle")).toBe("landing.styleShowcase.captions.lifestyle");
      expect(t("landing.styleShowcase.captions.scene")).toBe("landing.styleShowcase.captions.scene");

      const showcaseCopy = [
        t("landing.styleShowcase.subtitle"),
        ...frames.flatMap((tab) => [
          t(`landing.styleShowcase.tabs.${tab.key}`),
          t(`landing.styleShowcase.tooltips.${tab.key}`),
          ...tab.images.map((image) => t(image.captionKey)),
        ]),
      ];
      for (const text of showcaseCopy) {
        const folded = text.toLowerCase();
        for (const stale of STALE_STYLE_COPY) {
          expect(folded, `${code}: ${text}`).not.toContain(stale.toLowerCase());
        }
      }

      for (const image of frames.flatMap((tab) => tab.images)) {
        const caption = t(image.captionKey);
        expect(caption, `${code} ${image.id}`).not.toBe(image.captionKey);
        expect(caption.trim().length).toBeGreaterThan(0);
      }
    }

    const en = createT(getMessages("en"));
    const zh = createT(getMessages("zh"));
    for (const id of STYLE_IDS) {
      expect(en(`landing.styleShowcase.captions.${id}`)).toBe(EN_CAPTIONS[id]);
      expect(zh(`landing.styleShowcase.captions.${id}`)).toBe(ZH_CAPTIONS[id]);
    }
    expect(en("landing.styleShowcase.tabs.material")).toBe("Material");
    expect(en("landing.styleShowcase.tabs.lifestyle")).toBe("Lifestyle");
    expect(en("landing.styleShowcase.tabs.scene")).toBe("Scene");
    expect(zh("landing.styleShowcase.tabs.material")).toBe("材质");
    expect(zh("landing.styleShowcase.tabs.lifestyle")).toBe("生活场景");
    expect(zh("landing.styleShowcase.tabs.scene")).toBe("场景");

    expect(en("landing.heroCards.footnote").toLowerCase()).toContain("watch");
    expect(en("landing.heroCards.before")).toBe("Before");
    expect(en("landing.heroCards.after")).toBe("After");
    expect(zh("landing.heroCards.footnote")).toContain("腕表");
    expect(zh("landing.heroCards.before")).toBe("原图");
    expect(zh("landing.heroCards.after")).toBe("成片");
    expect(en(HOMEPAGE_HERO_ALT.before)).toBe("Source product photo of an Omega Speedmaster on white fabric");
    expect(en(HOMEPAGE_HERO_ALT.after)).toBe(
      "Flashant frame of the same steel chronograph and bracelet on a dark ground"
    );
    expect(zh(HOMEPAGE_HERO_ALT.before)).toBe("白色织物上的 Omega Speedmaster 产品原图");
    expect(zh(HOMEPAGE_HERO_ALT.after)).toBe("闪象成片：同一块钢壳计时表和钢链，暗底");
  });
});
