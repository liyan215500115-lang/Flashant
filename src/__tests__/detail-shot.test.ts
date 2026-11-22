import { describe, expect, it } from "vitest";
import {
  BEAUTY_PERSON_CLOSEUP_PROMPT,
  planPackShot,
  PRODUCT_MACRO_LOCK,
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
});
