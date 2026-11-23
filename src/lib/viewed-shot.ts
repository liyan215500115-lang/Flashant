import { generatedImageFilePath } from "@/lib/stored-image";

export interface ViewedShot {
  id?: string | null;
  url?: string | null;
  label?: string | null;
}

/** File route for a stored shot. A shot with no id keeps its display URL. */
export function viewedShotFileUrl(shot: ViewedShot): string | null {
  const id = shot.id?.trim() || "";
  if (id) return generatedImageFilePath(id);
  const url = shot.url?.trim() || "";
  return url || null;
}

/** An open lightbox is the image the user is looking at. Otherwise the canvas. */
export function shotBeingViewed<T extends ViewedShot>(input: {
  lightbox: T | null;
  canvas: T | null;
}): T | null {
  if (input.lightbox && viewedShotFileUrl(input.lightbox)) return input.lightbox;
  if (input.canvas && viewedShotFileUrl(input.canvas)) return input.canvas;
  return null;
}

/** Pack tile click: the canvas should show this shot, not the previous one. */
export function canvasImageFromViewedShot(shot: ViewedShot): { id: string; url: string; promptUsed: string } | null {
  const url = shot.url?.trim() || "";
  if (!url) return null;
  return {
    id: shot.id?.trim() || "",
    url,
    promptUsed: shot.label?.trim() || "",
  };
}
