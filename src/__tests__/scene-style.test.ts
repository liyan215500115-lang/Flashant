import { describe, expect, it } from "vitest";
import { STYLE_PROMPTS } from "@/lib/ai/style-prompts";
import {
  isSceneShot,
  matchSelectedStyle,
  resolveSelectedStyle,
  sceneShotRole,
  sceneStyleHint,
} from "@/lib/generate/scene-style";

const outdoor = STYLE_PROMPTS.find((style) => style.key === "natural")!;

describe("selected scene style", () => {
  it("recognizes the full 户外自然 description in every picker variant", () => {
    expect(matchSelectedStyle(`使用场景 — ${outdoor.promptZh}`)?.key).toBe("natural");
    expect(matchSelectedStyle(outdoor.prompt)?.key).toBe("natural");
    expect(matchSelectedStyle(outdoor.promptFlux)?.key).toBe("natural");
    expect(matchSelectedStyle(outdoor.promptFluxZh)?.key).toBe("natural");
    const bria = outdoor.promptFlux.replace(/Keep the product identical to the reference image,?\s*/i, "");
    expect(matchSelectedStyle(bria)?.key).toBe("natural");
    expect(matchSelectedStyle("Product in natural style")).toBeNull();
    expect(matchSelectedStyle("DR.ALVA black bottle on a bathroom vanity")).toBeNull();
  });

  it("prefers an explicit style key, including when style lock text is absent", () => {
    expect(resolveSelectedStyle({
      sceneStyleKey: "natural",
      texts: ["Product in natural style"],
    })?.key).toBe("natural");
    expect(resolveSelectedStyle({
      sceneStyleKey: " ",
      texts: [outdoor.promptZh],
    })?.key).toBe("natural");
    expect(resolveSelectedStyle({ sceneStyleKey: "nope", texts: ["lotion"] })).toBeNull();
  });

  it("states golden-hour outdoors for 户外自然 without indoor or beauty-default lighting", () => {
    const hint = sceneStyleHint(outdoor);
    expect(hint).toContain("户外自然");
    expect(hint.toLowerCase()).toContain("golden-hour");
    expect(hint.toLowerCase()).toContain("outdoor");
    expect(hint.toLowerCase()).toContain("mossy stone");
    expect(hint.toLowerCase()).toContain("weathered wood");
    expect(hint.toLowerCase()).toContain("beach");
    expect(hint.toLowerCase()).not.toContain("large windows");
    expect(hint.toLowerCase()).not.toContain("charcoal");
    expect(hint.toLowerCase()).not.toContain("cyan");
    expect(hint.toLowerCase()).not.toContain("bathroom");

    expect(isSceneShot("lifestyle")).toBe(true);
    expect(isSceneShot("scene_atmosphere")).toBe(true);
    expect(isSceneShot("in_use")).toBe(true);
    expect(isSceneShot("selling_points")).toBe(false);

    expect(sceneShotRole("lifestyle").toLowerCase()).toContain("usage");
    expect(sceneShotRole("scene_atmosphere").toLowerCase()).toContain("emotional");
    expect(sceneShotRole("in_use").toLowerCase()).toContain("used or worn");
    for (const key of ["lifestyle", "scene_atmosphere", "in_use"]) {
      const role = sceneShotRole(key).toLowerCase();
      expect(role).not.toContain("large windows");
      expect(role).not.toContain("bathroom");
      expect(role).not.toContain("charcoal");
      expect(role).not.toContain("practical place where it would actually be used");
    }
  });

  it("gives every left-side style its own setting line", () => {
    for (const style of STYLE_PROMPTS) {
      const hint = sceneStyleHint(style);
      expect(hint).toContain(style.zh);
      expect(hint.toLowerCase()).not.toContain("large windows");
    }
  });
});
