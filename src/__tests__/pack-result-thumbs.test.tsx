import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StudioDetailPanel } from "@/components/studio/detail-panel";

const SHOTS = [
  { key: "flatlay", url: "https://cdn.example/flatlay.png", label: "平铺展示", rawUrl: "https://cdn.example/flatlay.png", id: "flat" },
  { key: "detail", url: "https://cdn.example/detail.png", label: "细节特写", rawUrl: "https://cdn.example/detail.png", id: "detail" },
  { key: "multi_angle", url: "https://cdn.example/angles.png", label: "多角度", rawUrl: "https://cdn.example/angles.png", id: "angles" },
  { key: "selling_points", url: "https://cdn.example/sell.png", label: "核心卖点", rawUrl: "https://cdn.example/sell.png", id: "sell" },
  { key: "compare", url: "https://cdn.example/compare.png", label: "效果对比", rawUrl: "https://cdn.example/compare.png", id: "compare" },
  { key: "scene_atmosphere", url: "https://cdn.example/mood.png", label: "场景氛围", rawUrl: "https://cdn.example/mood.png", id: "mood" },
];

describe("pack result thumbnails", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  });

  async function render(node: ReactNode) {
    await act(async () => {
      root?.render(node);
    });
  }

  it("gives every grouped result tile the same complete square, including flatlay, detail, and compare", async () => {
    await render(
      <StudioDetailPanel
        projectId="proj-thumbs"
        productImageId="img-1"
        basePrompt="product"
        initialResults={SHOTS}
      />,
    );

    const thumbs = [...(container?.querySelectorAll("[data-testid='pack-result-thumb']") ?? [])];
    expect(thumbs.map((thumb) => thumb.getAttribute("data-shot-key"))).toEqual([
      "scene_atmosphere",
      "detail",
      "multi_angle",
      "flatlay",
      "selling_points",
      "compare",
    ]);
    expect(thumbs).toHaveLength(SHOTS.length);

    for (const thumb of thumbs) {
      const button = thumb as HTMLButtonElement;
      expect(button.style.aspectRatio).toBe("1 / 1");
      expect(button.style.width).toBe("100%");
      expect(button.style.padding).toBe("0px");
      expect(button.style.borderWidth).toBe("0px");
      const image = button.querySelector("[data-testid='pack-result-thumb-image']") as HTMLImageElement | null;
      expect(image).not.toBeNull();
      expect(image?.style.position).toBe("absolute");
      expect(image?.style.width).toBe("100%");
      expect(image?.style.height).toBe("100%");
      expect(image?.style.objectFit).toBe("contain");
      expect(image?.style.objectPosition).toBe("center");
      expect(image?.className).not.toContain("object-cover");
      expect(button.className).not.toContain("object-cover");
    }
  });
});
