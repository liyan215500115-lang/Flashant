import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createT, getMessages } from "@/lib/messages";
import { composePoster } from "@/lib/poster/compose";
import { normalizePosterCopy, parsePosterJob, posterCopyLines } from "@/lib/poster/copy";
import { faceIdsForLanguage, shapePosterText } from "@/lib/poster/fonts";
import type { PosterCopy } from "@/lib/poster/copy";

const COPY: PosterCopy = {
  series: "AMBER STILL 磨砂",
  title: "磨砂圆柱瓶身，厚圆片玻璃塞。",
  dek: "浅蜜琥珀色液面可见，开盖即可使用。",
  tags: [
    { en: "FROSTED", cn: "磨砂瓶身" },
    { en: "STOPPER", cn: "玻璃塞" },
    { en: "AMBER", cn: "琥珀" },
  ],
};

async function frame(width: number, height: number, paint: { left: number; top: number; width: number; height: number; color: { r: number; g: number; b: number } } | null, background: { r: number; g: number; b: number }) {
  const base = sharp({
    create: { width, height, channels: 3, background },
  });
  if (!paint) return base.png().toBuffer();
  const swatch = await sharp({
    create: { width: paint.width, height: paint.height, channels: 3, background: paint.color },
  }).png().toBuffer();
  return base.composite([{ input: swatch, left: paint.left, top: paint.top }]).png().toBuffer();
}

function job(copy: PosterCopy, template: "auto" | "A" | "B" | "C" = "B", market: "zh" | "en" | "ja" | "ko" = "zh", shotKey?: string) {
  return { template, market, copy, shotKey };
}

describe("poster copy", () => {
  it("does not invent merchant copy and drops empty layers", () => {
    expect(normalizePosterCopy(undefined)).toEqual({ series: "", title: "", dek: "", tags: [] });
    expect(parsePosterJob({ enabled: false, copy: COPY })).toBeNull();
    expect(parsePosterJob({ enabled: true, copy: { dek: "only a dek", tags: [{ en: "TAG", cn: "" }] } })).toBeNull();
    expect(parsePosterJob({ enabled: true, market: "en", copy: { title: "Hello" } })?.copy).toEqual({
      series: "",
      title: "Hello",
      dek: "",
      tags: [],
    });
    expect(posterCopyLines({ title: "Hello", series: "" })).toEqual(["Hello"]);
  });

  it("keeps lifestyle shots out of v1", () => {
    expect(parsePosterJob({ enabled: true, copy: { title: "Hello" } }, "lifestyle")).toBeNull();
    expect(parsePosterJob({ enabled: true, copy: { title: "Hello" } }, "in_use")).toBeNull();
    expect(parsePosterJob({ enabled: true, copy: { title: "Hello" } }, "detail")?.shotKey).toBe("detail");
  });
});

describe("poster languages", () => {
  it("chooses a face list from the selected language, not from the letters alone", () => {
    expect(faceIdsForLanguage("zh")).toContain("droid-sans-fallback");
    expect(faceIdsForLanguage("zh")).not.toContain("noto-sans-jp-regular");
    expect(faceIdsForLanguage("en")).not.toContain("noto-sans-kr-regular");
    expect(faceIdsForLanguage("ja")).toContain("noto-sans-jp-regular");
    expect(faceIdsForLanguage("ko")).toContain("noto-sans-kr-regular");

    const zhKana = shapePosterText("あ", 32, "regular", 0, "zh");
    const jaKana = shapePosterText("あ", 32, "regular", 0, "ja");
    expect(zhKana[0].face?.spec.id).toBe("droid-sans-fallback");
    expect(jaKana[0].face?.spec.id).toBe("noto-sans-jp-regular");

    const koHangul = shapePosterText("한", 32, "regular", 0, "ko");
    expect(koHangul[0].face?.spec.id).toBe("noto-sans-kr-regular");
    expect(() => shapePosterText("한", 32, "regular", 0, "en")).toThrow("caption_glyphs_missing");
    expect(() => shapePosterText("한", 32, "regular", 0, "zh")).toThrow("caption_glyphs_missing");
  });

  it("draws mixed Chinese and Latin with real glyphs", () => {
    const shaped = shapePosterText("AB磨", 48, "bold", 0, "zh");
    expect(shaped.map((glyph) => glyph.face?.spec.id)).toEqual([
      "noto-sans-bold",
      "noto-sans-bold",
      "droid-sans-fallback",
    ]);
    expect(shaped.every((glyph) => glyph.face && glyph.width > 0)).toBe(true);
  });
});

describe("poster layout", () => {
  const quiet = () => frame(360, 480, {
    left: 110,
    top: 190,
    width: 140,
    height: 140,
    color: { r: 180, g: 40, b: 40 },
  }, { r: 22, g: 18, b: 16 });

  it("folds an empty dek instead of reserving its gap", async () => {
    const image = await quiet();
    const withDek = await composePoster(image, job(COPY, "B"));
    const withoutDek = await composePoster(image, job({ ...COPY, dek: "" }, "B"));
    expect(withDek?.stack.dekTop).not.toBeNull();
    expect(withoutDek?.stack.dekTop).toBeNull();
    expect(withoutDek?.stack.tagTop ?? 0).toBeLessThan(withDek?.stack.tagTop ?? 0);
  });

  it("falls back from A to B when type would hit the product", async () => {
    const image = await frame(360, 480, {
      left: 30,
      top: 8,
      width: 300,
      height: 150,
      color: { r: 180, g: 40, b: 40 },
    }, { r: 22, g: 18, b: 16 });
    const result = await composePoster(image, job({
      series: "",
      title: "瓶",
      dek: "",
      tags: [],
    }, "A"));
    expect(result?.template).toBe("B");
    expect(result?.fallback).toBe("collision");
    expect(result?.canvas.height).toBeGreaterThan(480);
    expect(result?.photo.top).toBeGreaterThan(0);
    const { data, info } = await sharp(result!.buffer).raw().toBuffer({ resolveWithObject: true });
    let red = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] > 150 && data[i + 2] < 80) red += 1;
    }
    expect(red).toBeGreaterThan(20);
  });

  it("falls back from A to B when glyph contrast is too low", async () => {
    const image = await frame(360, 480, {
      left: 140,
      top: 220,
      width: 80,
      height: 80,
      color: { r: 180, g: 40, b: 40 },
    }, { r: 125, g: 125, b: 125 });
    const result = await composePoster(image, job({ ...COPY, tags: [], dek: "" }, "A"));
    expect(result?.template).toBe("B");
    expect(result?.fallback).toBe("contrast");
    expect(result?.photo.top).toBeGreaterThan(0);
  });

  it("shrinks the C plinth when only the title remains", async () => {
    const image = await frame(480, 480, null, { r: 90, g: 70, b: 50 });
    const full = await composePoster(image, job(COPY, "C", "zh", "material"));
    const titleOnly = await composePoster(image, job({
      series: "",
      title: "乳白开片釉",
      dek: "",
      tags: [],
    }, "C", "zh", "material"));
    expect(full?.plinthHeight).toBeGreaterThan(titleOnly?.plinthHeight ?? 0);
    expect((titleOnly?.plinthHeight ?? 1) / (titleOnly?.canvas.height ?? 1)).toBeLessThan(0.22);
    expect(titleOnly?.stack.dekTop).toBeNull();
    expect(titleOnly?.stack.tagTop).toBeNull();
  });

  it("does not paint a missing glyph", async () => {
    const image = await frame(240, 320, null, { r: 255, g: 255, b: 255 });
    await expect(composePoster(image, job({ ...COPY, title: "瓶\uE000" }, "B"))).rejects.toThrow("caption_glyphs_missing");
  });

  it("keeps a 4:3 frame instead of cropping it to 3:4", async () => {
    const image = await frame(480, 360, {
      left: 280,
      top: 40,
      width: 160,
      height: 280,
      color: { r: 180, g: 40, b: 40 },
    }, { r: 22, g: 18, b: 16 });
    const result = await composePoster(image, job(COPY, "A"));
    expect(result?.template === "A" ? result.canvas : result?.canvas).toMatchObject(
      result?.template === "A" ? { width: 480, height: 360 } : { width: 480 },
    );
    if (result?.template === "A") {
      expect(result.canvas).toEqual({ width: 480, height: 360 });
    }
  });
});

describe("poster workbench copy", () => {
  it("has Chinese and English strings for the new controls", () => {
    const zh = createT(getMessages("zh"));
    const en = createT(getMessages("en"));
    for (const key of [
      "studio.poster.toggle",
      "studio.poster.language",
      "studio.poster.languageHint",
      "studio.poster.fieldTitle",
      "studio.poster.reapply",
      "studio.poster.templateA",
      "studio.poster.templateB",
      "studio.poster.templateC",
      "studio.poster.missingGlyph",
    ]) {
      expect(zh(key), key).not.toBe(key);
      expect(en(key), key).not.toBe(key);
      expect(zh(key)).not.toBe(en(key));
    }
    expect(zh("studio.poster.languageHint")).toContain("不会");
    expect(en("studio.poster.languageHint").toLowerCase()).toContain("does not");
    expect(zh("studio.poster.langJa")).toBe("日本語");
    expect(zh("studio.poster.langKo")).toBe("한국어");
  });
});
