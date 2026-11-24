import { beforeEach, describe, expect, it, vi } from "vitest";
import { packWorkbenchEngine, singleImageEngineType } from "@/lib/generate/pack-engine";
import { captionSpecText, isStyleBoilerplateCaption } from "@/lib/generate/info-shots";
import { isOwnedStorageKey } from "@/lib/stored-image";
import { noteFilledOnSelect, packShotRequest, persistedShotNotes } from "@/lib/generate/pack-shot-request";

describe("pack workbench engine", () => {
  it("shows the configured Vega model before a shot runs", () => {
    expect(packWorkbenchEngine({
      vegaConfigured: true,
      providerModel: "wand-vega-image-1.5-pro",
      configuredModel: "wand-vega-image-1.5-pro",
    })).toEqual({ engine: "vega", label: "wand-vega-image-1.5-pro" });
    expect(packWorkbenchEngine({
      vegaConfigured: true,
      providerModel: "",
      configuredModel: "wand-vega-image-1.5-pro",
    }).label).toBe("wand-vega-image-1.5-pro");
  });

  it("stays on flux when Vega is not fully configured", () => {
    expect(packWorkbenchEngine({
      vegaConfigured: false,
      providerModel: "wand-vega-image-1.5-pro",
      configuredModel: "wand-vega-image-1.5-pro",
    })).toEqual({ engine: "flux", label: "" });
  });

  it("does not switch the single-image request just because the pack selector shows Vega", () => {
    expect(singleImageEngineType({
      selectedEngine: "vega",
      packEngineAutoSelected: true,
      userChoseEngine: false,
    })).toBe("flux");
    expect(singleImageEngineType({
      selectedEngine: "bria",
      packEngineAutoSelected: true,
      userChoseEngine: true,
    })).toBe("bria");
  });
});

describe("owned storage keys", () => {
  it("rejects provider URLs and failure sentinels", () => {
    expect(isOwnedStorageKey("generated/unit.png")).toBe(true);
    expect(isOwnedStorageKey("https://replicate.delivery/out.png")).toBe(false);
    expect(isOwnedStorageKey("https://cos.ap-shanghai.myqcloud.com/vega.png")).toBe(false);
    expect(isOwnedStorageKey("failed")).toBe(false);
    expect(isOwnedStorageKey("pending")).toBe(false);
  });
});

describe("pack shot request", () => {
  it("keeps spec text out of the model prompt field", () => {
    const shot = packShotRequest({
      key: "selling_points",
      label: "核心卖点",
      basePrompt: "Dr.ALVA 乳液",
      note: "温和保湿",
      info: true,
    });
    expect(shot.prompt).toBe("");
    expect(shot.specText).toBe("温和保湿");
    expect(shot.prompt).not.toContain("温和保湿");

    const scene = packShotRequest({
      key: "lifestyle",
      label: "使用场景",
      basePrompt: "浴室晨光",
      note: "手持特写",
      info: false,
    });
    expect(scene.prompt).toContain("手持特写");
    expect(scene.specText).toBeUndefined();
  });

  it("does not overlay style boilerplate when the left prompt is empty", () => {
    expect(isStyleBoilerplateCaption("Product in clean style")).toBe(true);
    expect(isStyleBoilerplateCaption("Product in dark_moody style")).toBe(true);
    expect(isStyleBoilerplateCaption("  Product in natural style.  ")).toBe(true);
    expect(captionSpecText("Product in clean style")).toBe("");
    expect(isStyleBoilerplateCaption("温和保湿")).toBe(false);
    expect(isStyleBoilerplateCaption("Product in clean lifestyle")).toBe(false);

    for (const key of ["selling_points", "material", "size", "craft", "compare"]) {
      const shot = packShotRequest({
        key,
        label: "核心卖点",
        basePrompt: "Product in clean style",
        note: "Product in clean style",
        info: true,
      });
      expect(shot.prompt).toBe("");
      expect(shot.specText).toBeUndefined();
      expect(shot).not.toMatchObject({ specText: "Product in clean style" });
    }

    const explicit = packShotRequest({
      key: "selling_points",
      label: "核心卖点",
      basePrompt: "Product in clean style",
      note: "温和保湿",
      info: true,
    });
    expect(explicit.specText).toBe("温和保湿");
    expect(explicit.prompt).toBe("");

    const sameAsLeftPrompt = packShotRequest({
      key: "selling_points",
      label: "核心卖点",
      basePrompt: "温和保湿",
      note: "温和保湿",
      info: true,
    });
    expect(sameAsLeftPrompt.specText).toBe("温和保湿");

    const lifestyle = packShotRequest({
      key: "lifestyle",
      label: "使用场景",
      basePrompt: "Product in clean style",
      note: "Product in clean style",
      info: false,
    });
    expect(lifestyle.prompt).toContain("Product in clean style");
    expect(lifestyle.specText).toBeUndefined();
  });

  it("seeds visual notes for scene shots and leaves info-shot spec text empty", () => {
    expect(noteFilledOnSelect({
      info: true,
      basePrompt: "Product in clean style",
    })).toBeNull();
    expect(noteFilledOnSelect({
      info: true,
      basePrompt: "蓝牙降噪",
    })).toBeNull();
    expect(noteFilledOnSelect({
      info: true,
      existingNote: "温和保湿",
      basePrompt: "Product in clean style",
    })).toBeNull();
    expect(noteFilledOnSelect({
      info: false,
      basePrompt: "Product in clean style",
    })).toBe("Product in clean style");
    expect(noteFilledOnSelect({
      info: false,
      existingNote: "浴室晨光",
      basePrompt: "Product in clean style",
    })).toBeNull();

    expect(persistedShotNotes({
      selling_points: "Product in clean style",
      material: "温和保湿",
      lifestyle: "Product in clean style",
    })).toEqual({
      material: "温和保湿",
      lifestyle: "Product in clean style",
    });
  });
});

describe("GET /api/generate/pack-engine", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TENCENT_MAAS_API_KEY", "");
    vi.stubEnv("TENCENT_MAAS_BASE_URL", "");
    vi.stubEnv("TENCENT_MAAS_IMAGE_MODEL", "");
    vi.stubEnv("TENCENT_MAAS_LITE_IMAGE_MODEL", "");
  });

  it("returns flux when the four Vega settings are absent and never echoes them", async () => {
    vi.doMock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user_1" } })) }));
    const { GET } = await import("@/app/api/generate/pack-engine/route");
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ engine: "flux", modelVersion: null });
    expect(JSON.stringify(json)).not.toContain("TENCENT_MAAS");
  });

  it("returns the model id when Vega is configured, not the key or base URL", async () => {
    vi.stubEnv("TENCENT_MAAS_API_KEY", "unit-test-placeholder");
    vi.stubEnv("TENCENT_MAAS_BASE_URL", "https://maas.example.test");
    vi.stubEnv("TENCENT_MAAS_IMAGE_MODEL", "wand-vega-image-1.5-pro");
    vi.stubEnv("TENCENT_MAAS_LITE_IMAGE_MODEL", "wand-vega-image-lite");
    vi.doMock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user_1" } })) }));
    vi.doMock("@/lib/ai/registry", () => ({
      getProvider: (name?: string) => {
        if (name !== "vega") throw new Error("unexpected provider");
        return { model: "wand-vega-image-1.5-pro" };
      },
    }));
    const { GET } = await import("@/app/api/generate/pack-engine/route");
    const res = await GET();
    const text = await res.text();
    expect(text).toContain("wand-vega-image-1.5-pro");
    expect(text).not.toContain("unit-test-placeholder");
    expect(text).not.toContain("maas.example.test");
    expect(text).not.toContain("TENCENT_MAAS");
  });
});
