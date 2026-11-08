import "server-only";

import { creemApiBaseUrl } from "@/lib/creem/client";

export type ModerationDecision = "allow" | "flag" | "deny" | "skipped" | "error";

/**
 * TODO (Creem account review): AI image products must screen every prompt with
 * POST /v1/moderation/prompt before it reaches the model. Checkout does not
 * depend on this. Set CREEM_MODERATION=enforce before requesting live review,
 * and fail closed (no generation) on flag, deny, or an API error.
 * Guide: https://docs.creem.io/features/moderation
 */
export function creemModerationEnforced(): boolean {
  return process.env.CREEM_MODERATION?.trim().toLowerCase() === "enforce";
}

export async function moderatePrompt(
  prompt: string,
  externalId: string
): Promise<{ allowed: boolean; decision: ModerationDecision }> {
  if (!creemModerationEnforced()) {
    return { allowed: true, decision: "skipped" };
  }

  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) {
    return { allowed: false, decision: "error" };
  }

  try {
    const res = await fetch(`${creemApiBaseUrl()}/moderation/prompt`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, external_id: externalId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { allowed: false, decision: "error" };
    const json = (await res.json()) as { decision?: string };
    if (json.decision === "allow") return { allowed: true, decision: "allow" };
    if (json.decision === "flag" || json.decision === "deny") {
      return { allowed: false, decision: json.decision };
    }
    return { allowed: false, decision: "error" };
  } catch {
    return { allowed: false, decision: "error" };
  }
}

export async function screenGenerationPrompts(input: {
  userId: string;
  prompts: Array<string | null | undefined>;
}): Promise<{ allowed: boolean; decision: ModerationDecision }> {
  if (!creemModerationEnforced()) {
    return { allowed: true, decision: "skipped" };
  }

  const prompts = input.prompts.map((prompt) => prompt?.trim() ?? "").filter(Boolean);
  if (prompts.length === 0) {
    return { allowed: true, decision: "skipped" };
  }

  for (const [index, prompt] of prompts.entries()) {
    const result = await moderatePrompt(prompt, `${input.userId}:${index}`);
    if (!result.allowed) return result;
  }
  return { allowed: true, decision: "allow" };
}
