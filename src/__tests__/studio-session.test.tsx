import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import { I18nProvider } from "@/components/i18n-provider";
import { StudioDetailPanel } from "@/components/studio/detail-panel";
import { restoreStudioSession, studioDetailPanelVisible } from "@/lib/studio-session";

const NOW = Date.parse("2026-11-28T00:00:00.000Z");

function credit(id = "pack_run") {
  return {
    id,
    finishedAt: "2026-11-27T00:00:00.000Z",
    requested: 2,
    completed: 1,
    creditsCharged: 1,
    creditsRefunded: 1,
    creditsNotCharged: 0,
    failed: [{ key: "flatlay", reason: "prediction_timeout", charged: true, creditsRefunded: true }],
  };
}

describe("studio projectId restore", () => {
  it("restores source images, the main shot, and opens the detail panel", () => {
    const session = restoreStudioSession({
      id: "proj_lotion",
      title: "乳液",
      productImages: [
        { id: "src_1", originalUrl: "https://cdn.example/source-a.png", fileName: "front.png", mimeType: "image/png" },
        { id: "src_2", originalUrl: "https://cdn.example/source-b.png", fileName: "back.png", mimeType: "image/png" },
      ],
      generatedImages: [{
        id: "gen_main",
        status: "SUCCEEDED",
        url: "https://cdn.example/hero.png",
        s3Key: "generated/hero.png",
        promptUsed: "soft light",
        createdAt: "2026-11-20T00:00:00.000Z",
        generationMeta: { sourceType: "main" },
      }],
    }, "zh", NOW);

    expect(session.productName).toBe("乳液");
    expect(session.sourceImages.map((image) => image.id)).toEqual(["src_1", "src_2"]);
    expect(session.selectedImage?.originalUrl).toBe("https://cdn.example/source-a.png");
    expect(session.latestImage).toMatchObject({
      id: "gen_main",
      url: "/api/generated-images/gen_main/file",
    });
    expect(session.generationHistory).toEqual([
      expect.objectContaining({ id: "gen_main", url: "/api/generated-images/gen_main/file" }),
    ]);
    expect(session.showDetailPanel).toBe(true);
    expect(session.latestImage?.url).not.toBe("");
  });

  it("restores a detail-only pack into history and the detail panel", () => {
    const session = restoreStudioSession({
      id: "proj_pack",
      title: "乳液",
      productImages: [
        { id: "src_1", originalUrl: "https://cdn.example/source.png", fileName: "front.png", mimeType: "image/png" },
      ],
      generatedImages: [{
        id: "gen_life",
        status: "SUCCEEDED",
        url: "https://cdn.example/lifestyle.png",
        s3Key: "generated/lifestyle.png",
        promptUsed: "lifestyle",
        createdAt: "2026-11-27T00:00:00.000Z",
        aiProvider: "vega",
        modelVersion: "wand-vega-image-1.5-pro",
        generationMeta: {
          sourceType: "detail",
          detailKey: "lifestyle",
          packId: "pack_run",
          packCredit: credit(),
        },
      }],
    }, "zh", NOW);

    expect(session.selectedImage?.id).toBe("src_1");
    expect(session.latestImage?.id).toBe("gen_life");
    expect(session.generationHistory.map((shot) => shot.id)).toEqual(["gen_life"]);
    expect(session.detailResults).toEqual([
      expect.objectContaining({
        key: "lifestyle",
        id: "gen_life",
        url: "/api/generated-images/gen_life/file",
      }),
    ]);
    expect(session.packSummary).toContain("已完成 1/2");
    expect(session.detailFailures.map((failure) => failure.key)).toEqual(["flatlay"]);
    expect(session.engine).toEqual({ engine: "vega", label: "wand-vega-image-1.5-pro" });
    expect(session.showDetailPanel).toBe(true);
    expect(studioDetailPanelVisible({
      projectId: session.projectId,
      hasSelectedImage: true,
      hasLatestImage: false,
      detailResultCount: 0,
      packSummary: "",
      failureCount: 0,
    })).toBe(false);
  });

  it("opens the detail panel for a restored pack failure even when no shot can be shown", () => {
    const session = restoreStudioSession({
      id: "proj_failed",
      title: "2026-11-01 draft",
      productImages: [
        { id: "src_1", originalUrl: "https://cdn.example/source.png", fileName: "front.png", mimeType: "image/jpeg" },
      ],
      generatedImages: [{
        id: "gen_old",
        status: "SUCCEEDED",
        url: "https://replicate.delivery/pbxt/expired.png",
        s3Key: "https://replicate.delivery/pbxt/expired.png",
        createdAt: "2026-11-01T00:00:00.000Z",
        generationMeta: { sourceType: "main" },
      }, {
        id: "gen_fail",
        status: "FAILED",
        url: "",
        errorMessage: "prediction_timeout",
        generationMeta: {
          sourceType: "detail",
          detailKey: "detail",
          packId: "pack_run",
          packCredit: { ...credit(), completed: 0 },
        },
      }],
    }, "zh", NOW);

    expect(session.productName).toBe("");
    expect(session.latestImage).toBeNull();
    expect(session.generationHistory).toEqual([]);
    expect(session.detailResults).toEqual([]);
    expect(session.detailFailures.length).toBeGreaterThan(0);
    expect(session.showDetailPanel).toBe(true);
    expect(studioDetailPanelVisible({
      projectId: "proj_failed",
      hasSelectedImage: Boolean(session.selectedImage),
      hasLatestImage: false,
      detailResultCount: session.detailResults.length,
      packSummary: session.packSummary,
      failureCount: session.detailFailures.length,
    })).toBe(true);
  });

  it("does not open the detail panel when the project has no source image", () => {
    const session = restoreStudioSession({
      id: "proj_empty",
      title: "乳液",
      productImages: [],
      generatedImages: [],
    }, "zh", NOW);
    expect(session.selectedImage).toBeNull();
    expect(session.showDetailPanel).toBe(false);
  });
});

describe("restored detail panel", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    vi.unstubAllGlobals();
  });

  it("renders the restored pack shot when the panel conditions are met", () => {
    const session = restoreStudioSession({
      id: "proj_pack",
      title: "乳液",
      productImages: [
        { id: "src_1", originalUrl: "https://cdn.example/source.png", fileName: "front.png", mimeType: "image/png" },
      ],
      generatedImages: [{
        id: "gen_life",
        status: "SUCCEEDED",
        url: "https://cdn.example/lifestyle.png",
        s3Key: "generated/lifestyle.png",
        createdAt: "2026-11-27T00:00:00.000Z",
        generationMeta: { sourceType: "detail", detailKey: "lifestyle" },
      }],
    }, "zh", NOW);
    expect(session.showDetailPanel).toBe(true);
    expect(session.selectedImage).not.toBeNull();
    act(() => {
      root?.render(
        <I18nProvider locale="zh" messages={zh}>
          <StudioDetailPanel
            projectId={session.projectId}
            productImageId={session.selectedImage!.id}
            basePrompt="soft light"
            referenceImageUrl={session.latestImage?.url || session.selectedImage!.originalUrl}
            initialResults={session.detailResults}
            initialFailures={session.detailFailures}
            initialSummary={session.packSummary}
          />
        </I18nProvider>,
      );
    });
    const thumb = container?.querySelector("[data-testid='pack-result-thumb']");
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute("data-shot-key")).toBe("lifestyle");
    expect(container?.querySelector("[data-testid='pack-result-thumb-image']")?.getAttribute("src"))
      .toBe("/api/generated-images/gen_life/file");
  });
});
