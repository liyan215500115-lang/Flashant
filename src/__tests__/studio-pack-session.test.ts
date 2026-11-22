import { describe, expect, it } from "vitest";
import { applyCategoryChange, readPackDraft, writePackDraft } from "@/lib/studio-pack-session";

describe("studio pack selection", () => {
  it("changing category keeps selling points and the left-side style", () => {
    const next = applyCategoryChange({
      category: "fashion",
      recommended: {
        fashion: ["in_use", "multi_angle", "detail", "flatlay", "color_variants", "lifestyle"],
      },
      prompt: "金色耳环，手工金饰",
      style: "in_use",
      perTypeDesc: { selling_points: "925 金，不改这条商品卖点" },
      currentSelected: ["selling_points"],
    });
    expect(next.prompt).toBe("金色耳环，手工金饰");
    expect(next.style).toBe("in_use");
    expect(next.perTypeDesc.selling_points).toBe("925 金，不改这条商品卖点");
    expect(next.selected).toHaveLength(6);
    expect(next.selected).not.toHaveLength(0);
  });

  it("restores selected shots and pack mode for the same project", () => {
    const storage = new Map<string, string>();
    const memory = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    } as Storage;
    writePackDraft("proj_earrings", {
      selected: ["detail", "flatlay"],
      category: "fashion",
      lockStyle: true,
      perTypeDesc: { detail: "金扣微距" },
      open: true,
    }, memory);
    expect(readPackDraft("proj_earrings", memory)).toMatchObject({
      selected: ["detail", "flatlay"],
      category: "fashion",
      lockStyle: true,
      open: true,
    });
    expect(readPackDraft("other", memory)).toBeNull();
  });
});
