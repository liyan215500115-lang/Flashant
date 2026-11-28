/**
 * Layout decisions for the project detail page.
 * Counts, columns, and which header controls are usable live here so the
 * page can restyle without inventing a second set of rules.
 */

export type DetailViewport = "phone" | "narrow" | "wide";

export type GalleryColumns = 1 | 2 | 3;

export type ContinuePlacement = "none" | "tile" | "bar";

export type EmptyPlacement = "none" | "full" | "beside" | "below";

export type ShotSummary = "empty" | "source" | "generated" | "mixed";

export type StatusPill = "generated" | "pending";

export interface HeaderActionState {
  /** At least one successful generated image has a file that can be saved. */
  downloadEnabled: boolean;
  publishEnabled: boolean;
  /** Download is the solid primary only when it is enabled. Otherwise the studio link is. */
  primary: "download" | "studio";
  /** Source images or successful shots can be selected. A fully empty project cannot. */
  selectEnabled: boolean;
  /** Header delete stays available, including on a fully empty project. */
  deleteEnabled: true;
}

export function detailViewportFromWidth(width: number): DetailViewport {
  if (width <= 520) return "phone";
  if (width <= 800) return "narrow";
  return "wide";
}

/**
 * Phone is one column. A single original pairs with the empty explanation, so
 * that state stays two columns until the phone breakpoint. Three or more real
 * tiles use three columns on a wide screen and two on a narrow one.
 */
export function galleryColumns(input: {
  viewport: DetailViewport;
  tileCount: number;
  sourceOnly: boolean;
}): GalleryColumns {
  if (input.viewport === "phone") return 1;
  if (input.sourceOnly && input.tileCount <= 1) return 2;
  const base: 2 | 3 = input.tileCount >= 3 ? 3 : 2;
  if (input.viewport === "narrow") return 2;
  return base;
}

/** The continue-generating control is a bar when it would be alone on the last row. */
export function continuePlacement(input: {
  selecting: boolean;
  generatedCount: number;
  tileCount: number;
  columns: number;
}): ContinuePlacement {
  if (input.selecting || input.generatedCount <= 0 || input.columns <= 0) return "none";
  if (input.tileCount % input.columns === 0) return "bar";
  return "tile";
}

export function emptyPlacement(input: {
  originalCount: number;
  generatedCount: number;
  columns: number;
}): EmptyPlacement {
  if (input.generatedCount > 0) return "none";
  if (input.originalCount <= 0) return "full";
  if (input.columns > 0 && input.originalCount % input.columns === 0) return "below";
  return "beside";
}

/** The number after 成片 is successful generated images only. */
export function shotSummary(originalCount: number, generatedCount: number): ShotSummary {
  if (generatedCount <= 0 && originalCount <= 0) return "empty";
  if (generatedCount <= 0) return "source";
  if (originalCount <= 0) return "generated";
  return "mixed";
}

export function statusPill(input: { loading: boolean; generatedCount: number }): StatusPill | null {
  if (input.loading) return null;
  return input.generatedCount > 0 ? "generated" : "pending";
}

export function headerActionState(input: {
  downloadableCount: number;
  originalCount: number;
  generatedCount: number;
}): HeaderActionState {
  const downloadEnabled = input.downloadableCount > 0;
  return {
    downloadEnabled,
    publishEnabled: downloadEnabled,
    primary: downloadEnabled ? "download" : "studio",
    selectEnabled: input.originalCount + input.generatedCount > 0,
    deleteEnabled: true,
  };
}
