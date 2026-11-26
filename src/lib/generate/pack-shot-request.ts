import { captionSpecText, isInfoShot, isStyleBoilerplateCaption } from "@/lib/generate/info-shots";

export interface PackShotRequest {
  key: string;
  prompt: string;
  specText?: string;
}

/**
 * Spec text is sent beside the prompt, never inside it.
 * Info shots use the server template for the picture and overlay only copy
 * the user typed as spec text. Style boilerplate is not a caption.
 */
export function packShotRequest(input: {
  key: string;
  label: string;
  basePrompt: string;
  note: string;
  info: boolean;
}): PackShotRequest {
  const note = input.note.trim();
  if (input.info) {
    const spec = captionSpecText(note);
    return spec
      ? { key: input.key, prompt: "", specText: spec }
      : { key: input.key, prompt: "" };
  }
  return {
    key: input.key,
    prompt: [input.label, input.basePrompt, note].filter(Boolean).join(" — "),
  };
}

/**
 * Non-info shots can inherit the left-side prompt as a visual note.
 * Info shots stay blank until the user types the words that should be drawn.
 */
export function noteFilledOnSelect(input: {
  info: boolean;
  existingNote?: string;
  basePrompt: string;
}): string | null {
  if (input.existingNote?.trim()) return null;
  if (input.info) return null;
  return input.basePrompt;
}

/** Drop saved info-shot notes that are only the style fallback sentence. */
export function persistedShotNotes(notes: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(notes)) {
    if (typeof value !== "string") continue;
    if (isInfoShot(key) && isStyleBoilerplateCaption(value)) continue;
    next[key] = value;
  }
  return next;
}
