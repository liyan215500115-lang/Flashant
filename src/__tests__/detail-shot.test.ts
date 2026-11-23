import { describe, expect, it } from "vitest";
import {
  applyPackPromptGuards,
  ATMOSPHERE_DISTINCT_COMPOSITION,
  BEAUTY_PERSON_CLOSEUP_PROMPT,
  COMPARE_NAMED_DIFFERENCES,
  COMPARE_ONLY_REAL_ATTRIBUTES,
  copyListsMultipleColors,
  extraPackInstructions,
  JEWELRY_SILHOUETTE_LOCK,
  LIFESTYLE_DISTINCT_COMPOSITION,
  MULTI_ANGLE_DISTINCT_VIEWS,
  NO_ELECTRONICS_ON_NONELECTRONIC,
  NO_INVENTED_ACCESSORIES,
  NO_SOURCE_WATERMARK,
  NO_UNSEEN_STRUCTURE,
  packShotTemplatePatch,
  packStyleLocked,
  planPackShot,
  PORTRAIT_REFERENCE_LOCK,
  PRODUCT_MACRO_LOCK,
  SELLING_POINTS_UNCHANGED_PRODUCT,
  shotIncludesPerson,
  SINGLE_COLOR_MERCHANDISING,
  SOURCE_STRUCTURE_LOCK,
  STYLE_LOCK_SAME_PRODUCT,
} from "@/lib/generate/detail-shot";

const product = "https://cdn.example/earrings.jpg";
const reference = "https://cdn.example/generated-face.png";

describe("pack detail close-ups", () => {
  it("keeps the product image for apparel and does not use a beauty smear prompt", () => {
    const plan = planPackShot({
      detailKey: "detail",
      category: "fashion",
      productImageUrl: product,
      referenceImageUrl: reference,
      referenceHasPerson: true,
      contextText: "a model wearing gold earrings",
    });
    expect(plan.mode).toBe("product_macro");
    expect(plan.productImageUrl).toBe(product);
    expect(plan.productImageUrl).not.toBe("");
    expect(plan.referenceImageUrl).toBeUndefined();
    expect(plan.promptOverride).toBeUndefined();
    expect(plan.omitCategoryHint).toBe(true);
    expect(PRODUCT_MACRO_LOCK).not.toContain("visible in use (on skin");
    expect(BEAUTY_PERSON_CLOSEUP_PROMPT).toContain("on skin");
  });

  it("allows a face close-up for beauty only when the reference contains a person, and still sends the product", () => {
    const withPerson = planPackShot({
      detailKey: "detail",
      category: "beauty",
      productImageUrl: product,
      referenceImageUrl: reference,
      contextText: "model applying cream on her face",
    });
    expect(withPerson.mode).toBe("beauty_person_closeup");
    expect(withPerson.productImageUrl).toBe(product);
    expect(withPerson.promptOverride).toBe(BEAUTY_PERSON_CLOSEUP_PROMPT);

    const productOnly = planPackShot({
      detailKey: "detail",
      category: "beauty",
      productImageUrl: product,
      referenceImageUrl: reference,
      contextText: "glass serum bottle on a dark shelf",
      referenceHasPerson: false,
    });
    expect(productOnly.mode).toBe("product_macro");
    expect(productOnly.promptOverride).toBeUndefined();
    expect(productOnly.productImageUrl).toBe(product);
  });

  it("keeps the original product as the subject when style-lock supplies a reference", () => {
    for (const detailKey of ["in_use", "lifestyle", "scene_atmosphere", "detail"] as const) {
      const plan = planPackShot({
        detailKey,
        category: "fashion",
        productImageUrl: product,
        referenceImageUrl: reference,
        referenceHasPerson: true,
        contextText: "a model wearing the gold earrings",
      });
      expect(plan.productImageUrl, detailKey).toBe(product);
      expect(plan.productImageUrl, detailKey).not.toBe(reference);
      if (detailKey === "detail") {
        expect(plan.referenceImageUrl, detailKey).toBeUndefined();
        expect(plan.promptOverride, detailKey).toBeUndefined();
      } else {
        expect(plan.referenceImageUrl, detailKey).toBe(reference);
        expect(plan.mode, detailKey).toBe("scene_reference");
      }
    }
  });

  it("locks the same product and style only when style-lock is on, and always forbids source watermarks", () => {
    expect(packStyleLocked({ baseStyle: "金色耳环，手工金饰" })).toBe(true);
    expect(packStyleLocked({ referenceImageUrl: reference })).toBe(true);
    expect(packStyleLocked({ baseStyle: "  ", referenceImageUrl: "" })).toBe(false);

    const locked = applyPackPromptGuards("flatlay of the earrings", {
      detailKey: "flatlay",
      styleLocked: true,
    });
    expect(locked).toContain(STYLE_LOCK_SAME_PRODUCT);
    expect(locked).toContain("same material");
    expect(locked).toContain("same color");
    expect(locked).toContain("same overall style");
    expect(locked).toContain("AI生成");
    expect(locked).toContain("即梦AI");
    expect(locked.toLowerCase()).toContain("do not reproduce");
    expect(NO_SOURCE_WATERMARK).toContain("corner mark");

    const open = applyPackPromptGuards("flatlay of the earrings", {
      detailKey: "flatlay",
      styleLocked: false,
    });
    expect(open).not.toContain("Style lock:");
    expect(open).toContain(NO_SOURCE_WATERMARK);
  });

  it("asks multi-angle shots for distinguishable views instead of a symmetrical duplicate", () => {
    const prompt = applyPackPromptGuards("gold earrings angles", {
      detailKey: "multi_angle",
      styleLocked: true,
    });
    expect(prompt).toContain(MULTI_ANGLE_DISTINCT_VIEWS);
    expect(prompt).toContain("true side near 90 degrees");
    expect(prompt.toLowerCase()).toContain("nearly symmetrical");
    expect(prompt.toLowerCase()).toContain("earring");
    expect(prompt).not.toContain("2×2");
    expect(MULTI_ANGLE_DISTINCT_VIEWS.toLowerCase()).not.toContain("equal spacing");
    expect(prompt).toContain(STYLE_LOCK_SAME_PRODUCT);
    expect(prompt).toContain("same face");
    expect(prompt).toContain("same features");
    expect(prompt).toContain("same skin tone");
    expect(prompt).toContain(NO_SOURCE_WATERMARK);
  });

  it("keeps every multi-angle panel on one SKU and requires the earring finding", () => {
    expect(MULTI_ANGLE_DISTINCT_VIEWS).toContain("same SKU");
    expect(MULTI_ANGLE_DISTINCT_VIEWS).toContain("same outline");
    expect(MULTI_ANGLE_DISTINCT_VIEWS).toContain("same bezel or frame");
    expect(MULTI_ANGLE_DISTINCT_VIEWS.toLowerCase()).toContain("liquify");
    expect(MULTI_ANGLE_DISTINCT_VIEWS).toContain("ear post");
    expect(MULTI_ANGLE_DISTINCT_VIEWS).toContain("背扣");
    expect(MULTI_ANGLE_DISTINCT_VIEWS.toLowerCase()).toContain("ports");
    expect(MULTI_ANGLE_DISTINCT_VIEWS.toLowerCase()).not.toContain("equal spacing");
  });
});

describe("single-color merchandising and compare fidelity", () => {
  it("treats one named color as a single SKU, including a generic colors word", () => {
    expect(copyListsMultipleColors("gold earrings colors")).toBe(false);
    expect(copyListsMultipleColors("金色耳环")).toBe(false);
    expect(copyListsMultipleColors("closed white charging case")).toBe(false);
    expect(copyListsMultipleColors("")).toBe(false);
    expect(copyListsMultipleColors("gold and silver hoops")).toBe(true);
    expect(copyListsMultipleColors("black / white cases")).toBe(true);
    expect(copyListsMultipleColors("rose gold studs")).toBe(false);
  });

  it("replaces the color board when the copy names only one color", () => {
    const single = packShotTemplatePatch("color_variants", "gold earrings colors");
    expect(single.composition).toBe(SINGLE_COLOR_MERCHANDISING);
    expect(single.composition?.toLowerCase()).not.toContain("horizontal grid");
    expect(single.composition).toContain("C-shape");
    expect(single.camera).toContain("Do not build a color grid");
    expect(single.camera?.toLowerCase()).not.toContain("horizontal grid");

    const many = packShotTemplatePatch("color_variants", "gold and silver hoops");
    expect(many.composition).toBeUndefined();
  });

  it("lets compare contrast only real attributes and forbids an invented colorway or logo", () => {
    const single = packShotTemplatePatch("compare", "closed white charging case");
    expect(single.composition).toBe(COMPARE_ONLY_REAL_ATTRIBUTES);
    expect(single.composition).toContain("do not invent a second colorway");
    expect(single.composition).toContain("logo");
    expect(single.composition).toContain("garbled lettering");
    expect(single.composition).toContain("under-glow");

    const named = packShotTemplatePatch("compare", "black and white cases");
    expect(named.composition).toBe(COMPARE_NAMED_DIFFERENCES);
    expect(named.composition).toContain("Do not invent an extra colorway");
  });

  it("keeps selling points from inventing a brand or decorative light", () => {
    expect(SELLING_POINTS_UNCHANGED_PRODUCT).toContain("do not invent a logo");
    expect(SELLING_POINTS_UNCHANGED_PRODUCT).toContain("wordmark");
    expect(SELLING_POINTS_UNCHANGED_PRODUCT).toContain("under-glow");
    expect(SELLING_POINTS_UNCHANGED_PRODUCT).toContain("without changing its appearance");
  });
});

describe("pack fidelity instructions", () => {
  it("locks jewelry silhouette, including a closed bezel and a matched pair", () => {
    const lines = extraPackInstructions({
      detailKey: "multi_angle",
      category: "fashion",
      copy: "gold earrings with a tight wavy bezel",
    });
    expect(lines).toContain(JEWELRY_SILHOUETTE_LOCK);
    expect(lines).toContain(NO_UNSEEN_STRUCTURE);
    expect(lines).toContain(SOURCE_STRUCTURE_LOCK);
    expect(JEWELRY_SILHOUETTE_LOCK).toContain("matched pair");
    expect(JEWELRY_SILHOUETTE_LOCK).toContain("C-shape");
    expect(JEWELRY_SILHOUETTE_LOCK).toContain("tight wavy bezel");
  });

  it("blocks invented unboxing accessories and cables on a non-electronic product", () => {
    const story = extraPackInstructions({
      detailKey: "brand_story",
      category: "home",
      copy: "enclosed litter box",
    });
    expect(story).toContain(NO_INVENTED_ACCESSORIES);
    expect(NO_INVENTED_ACCESSORIES).toContain("scoops");
    expect(NO_INVENTED_ACCESSORIES).toContain("charging cable");
    expect(story).not.toContain(NO_ELECTRONICS_ON_NONELECTRONIC);

    const lifestyle = extraPackInstructions({
      detailKey: "lifestyle",
      category: "home",
      copy: "enclosed litter box",
    });
    expect(lifestyle).toContain(NO_ELECTRONICS_ON_NONELECTRONIC);
    expect(lifestyle).toContain(SOURCE_STRUCTURE_LOCK);
    expect(SOURCE_STRUCTURE_LOCK).toContain("chimney");
    expect(SOURCE_STRUCTURE_LOCK.toLowerCase()).toContain("stickers");
  });

  it("does not treat an electronics pack as a non-electronic product", () => {
    const lines = extraPackInstructions({
      detailKey: "lifestyle",
      category: "electronics",
      copy: "closed white charging case",
    });
    expect(lines).not.toContain(NO_ELECTRONICS_ON_NONELECTRONIC);
    expect(lines).toContain(SOURCE_STRUCTURE_LOCK);
  });

  it("makes usage and atmosphere compositions different frames", () => {
    expect(LIFESTYLE_DISTINCT_COMPOSITION).toContain("real usage setting");
    expect(LIFESTYLE_DISTINCT_COMPOSITION).toContain("Do not repeat the atmosphere shot");
    expect(ATMOSPHERE_DISTINCT_COMPOSITION).toContain("Spatial mood");
    expect(ATMOSPHERE_DISTINCT_COMPOSITION).toContain("lone hero");
    expect(ATMOSPHERE_DISTINCT_COMPOSITION).toContain("Do not repeat the usage shot");
    expect(LIFESTYLE_DISTINCT_COMPOSITION).not.toBe(ATMOSPHERE_DISTINCT_COMPOSITION);
  });

  it("passes a portrait into color variants and not into a product-only angle shot", () => {
    expect(shotIncludesPerson({ detailKey: "color_variants", category: "fashion", contextText: "gold earrings" })).toBe(true);
    expect(shotIncludesPerson({ detailKey: "lifestyle", category: "fashion", contextText: "gold earrings" })).toBe(true);
    expect(shotIncludesPerson({ detailKey: "in_use", category: "home", contextText: "litter box" })).toBe(true);
    expect(shotIncludesPerson({ detailKey: "lifestyle", category: "home", contextText: "litter box on a rug" })).toBe(false);
    expect(shotIncludesPerson({ detailKey: "scene_atmosphere", category: "home", contextText: "litter box" })).toBe(false);
    expect(shotIncludesPerson({ detailKey: "multi_angle", category: "electronics", contextText: "front of the case" })).toBe(false);

    const colors = planPackShot({
      detailKey: "color_variants",
      category: "fashion",
      productImageUrl: product,
      referenceImageUrl: product,
      portraitImageUrl: reference,
      contextText: "gold earrings",
    });
    expect(colors.productImageUrl).toBe(product);
    expect(colors.referenceImageUrl).toBe(reference);
    expect(colors.omitCategoryHint).toBe(true);

    const angle = planPackShot({
      detailKey: "multi_angle",
      category: "fashion",
      productImageUrl: product,
      referenceImageUrl: product,
      portraitImageUrl: reference,
      contextText: "gold earrings",
    });
    expect(angle.referenceImageUrl).toBe(product);
    expect(angle.referenceImageUrl).not.toBe(reference);

    const locked = extraPackInstructions({
      detailKey: "color_variants",
      category: "fashion",
      copy: "gold earrings",
      lockPortrait: true,
    });
    expect(locked).toContain(PORTRAIT_REFERENCE_LOCK);
    expect(PORTRAIT_REFERENCE_LOCK).toContain("same features");
    expect(PORTRAIT_REFERENCE_LOCK).toContain("same skin tone");
  });
});
