import { workbenchEngineFromShots } from "@/lib/generate/engine-label";
import { packRunViewFromImages } from "@/lib/generate/pack-run-client";
import { displayForGeneratedImage } from "@/lib/generated-image-display";

export interface StudioSourceImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

export interface StudioGeneratedImage {
  id?: string;
  url?: string | null;
  s3Key?: string | null;
  status?: string;
  promptUsed?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  aiProvider?: string | null;
  modelVersion?: string | null;
  generationMeta?: unknown;
}

export interface StudioProjectPayload {
  id: string;
  title?: string | null;
  productImages?: Array<{
    id?: string;
    originalUrl?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
  }>;
  generatedImages?: StudioGeneratedImage[];
}

export interface StudioPreviewShot {
  id: string;
  url: string;
  promptUsed: string;
}

export interface StudioDetailShot {
  key: string;
  url: string;
  rawUrl: string;
  label: string;
  id?: string;
}

export interface StudioSessionRestore {
  projectId: string;
  sourceImages: StudioSourceImage[];
  selectedImage: StudioSourceImage | null;
  productName: string;
  latestImage: StudioPreviewShot | null;
  generationHistory: StudioPreviewShot[];
  detailResults: StudioDetailShot[];
  detailFailures: Array<{ key: string; reason: string }>;
  packSummary: string;
  showDetailPanel: boolean;
  engine: { engine: "vega" | "flux"; label: string };
}

function metaRecord(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

function isDetailShot(image: StudioGeneratedImage): boolean {
  return metaRecord(image.generationMeta)?.sourceType === "detail";
}

function detailKey(image: StudioGeneratedImage): string {
  const key = metaRecord(image.generationMeta)?.detailKey;
  return typeof key === "string" && key ? key : "detail";
}

/**
 * Rebuild the studio from a project fetched for `?projectId=`.
 * Detail-pack shots are generated images too: they stay in history and can
 * open the detail panel even when the project has no separate main shot.
 * A dated draft title (starts with 202) is not a product name.
 */
export function restoreStudioSession(
  project: StudioProjectPayload,
  locale?: string,
  now = Date.now(),
): StudioSessionRestore {
  const sourceImages = (project.productImages ?? []).flatMap((image): StudioSourceImage[] => {
    if (!image?.id || !image.originalUrl) return [];
    return [{
      id: image.id,
      originalUrl: image.originalUrl,
      fileName: image.fileName || "image",
      mimeType: image.mimeType || "image/jpeg",
    }];
  });
  const selectedImage = sourceImages[0] ?? null;
  const title = project.title?.trim() ?? "";
  const productName = title && !title.startsWith("202") ? title : "";

  const generated = project.generatedImages ?? [];
  const displayable = generated.flatMap((image) => {
    if (image.status !== "SUCCEEDED" || !image.id) return [];
    const display = displayForGeneratedImage({
      id: image.id,
      status: image.status,
      url: image.url,
      s3Key: image.s3Key,
      createdAt: image.createdAt,
    }, now);
    if (!display.src) return [];
    return [{ image, src: display.src }];
  });

  const generationHistory = displayable.map(({ image, src }) => ({
    id: image.id || "",
    url: src,
    promptUsed: image.promptUsed || "",
  }));
  const preferred = displayable.find(({ image }) => !isDetailShot(image)) ?? displayable[0];
  const latestImage = preferred
    ? {
        id: preferred.image.id || "",
        url: preferred.src,
        promptUsed: preferred.image.promptUsed || "",
      }
    : null;

  const detailResults = displayable.flatMap(({ image, src }): StudioDetailShot[] => {
    if (!isDetailShot(image)) return [];
    const key = detailKey(image);
    return [{
      key,
      url: src,
      rawUrl: src,
      label: key,
      ...(image.id ? { id: image.id } : {}),
    }];
  });

  const packView = packRunViewFromImages(generated.map((image) => ({
    ...image,
    createdAt: image.createdAt ?? undefined,
  })), locale);
  let detailFailures: Array<{ key: string; reason: string }> = [];
  let packSummary = "";
  let engine = workbenchEngineFromShots(generated);
  if (packView) {
    packSummary = packView.summary;
    detailFailures = packView.failures;
    if (packView.engine.engine === "vega") engine = packView.engine;
  } else {
    detailFailures = generated.flatMap((image) => {
      if (image.status !== "FAILED" || !isDetailShot(image)) return [];
      return [{ key: detailKey(image), reason: image.errorMessage || "生成失败" }];
    });
  }

  return {
    projectId: project.id,
    sourceImages,
    selectedImage,
    productName,
    latestImage,
    generationHistory,
    detailResults,
    detailFailures,
    packSummary,
    showDetailPanel: studioDetailPanelVisible({
      projectId: project.id,
      hasSelectedImage: Boolean(selectedImage),
      hasLatestImage: Boolean(latestImage),
      detailResultCount: detailResults.length,
      packSummary,
      failureCount: detailFailures.length,
    }),
    engine,
  };
}

/** The pack panel needs the project, a source image, and something restored to edit. */
export function studioDetailPanelVisible(input: {
  projectId: string | null;
  hasSelectedImage: boolean;
  hasLatestImage: boolean;
  detailResultCount: number;
  packSummary: string;
  failureCount: number;
}): boolean {
  if (!input.projectId || !input.hasSelectedImage) return false;
  return Boolean(
    input.hasLatestImage
    || input.detailResultCount > 0
    || input.packSummary
    || input.failureCount > 0,
  );
}
