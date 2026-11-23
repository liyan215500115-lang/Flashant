export interface PackShotRequest {
  key: string;
  prompt: string;
  specText?: string;
}

/**
 * Spec text is sent beside the prompt, never inside it.
 * Info shots use the server template for the picture and overlay the spec afterwards.
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
    return note
      ? { key: input.key, prompt: "", specText: note }
      : { key: input.key, prompt: "" };
  }
  return {
    key: input.key,
    prompt: [input.label, input.basePrompt, note].filter(Boolean).join(" — "),
  };
}
