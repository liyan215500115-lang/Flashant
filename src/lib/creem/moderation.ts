import "server-only";

import { NextResponse } from "next/server";

const TEST_API_ORIGIN = "https://test-api.creem.io";
const LIVE_API_ORIGIN = "https://api.creem.io";
const MODERATION_PATH = "/v1/moderation/prompt";
const DEFAULT_TIMEOUT_MS = 5_000;
/** Ignore boilerplate shorter than this so common words are not stripped from user text. */
const MIN_FRAGMENT_LENGTH = 32;

export type ModerationDecision = "allow" | "flag" | "deny" | "skipped" | "error";

export interface ModerationGate {
  allowed: boolean;
  decision: ModerationDecision;
}

type Env = NodeJS.ProcessEnv;

function readEnv(env?: Env): Env {
  return env ?? process.env;
}

/**
 * `CREEM_MODERATION=off` skips screening (local development only).
 * Any other value, including unset, enforces moderation.
 * When enforcement is on and `CREEM_API_KEY` is missing, user prompts fail closed.
 */
export function creemModerationMode(env?: Env): "enforce" | "off" {
  const raw = readEnv(env).CREEM_MODERATION?.trim().toLowerCase() ?? "";
  if (raw === "off" || raw === "disabled" || raw === "disable" || raw === "false" || raw === "0") {
    return "off";
  }
  return "enforce";
}

/**
 * Sandbox when `CREEM_TEST_MODE` is truthy or the key starts with `creem_test_`.
 * An explicit `CREEM_TEST_MODE=false` selects the live host even for a test key.
 */
export function creemApiBaseUrl(env?: Env): string {
  const source = readEnv(env);
  const mode = source.CREEM_TEST_MODE?.trim().toLowerCase() ?? "";
  if (mode === "1" || mode === "true" || mode === "yes" || mode === "on") return TEST_API_ORIGIN;
  if (mode === "0" || mode === "false" || mode === "no" || mode === "off") return LIVE_API_ORIGIN;
  const key = source.CREEM_API_KEY?.trim() ?? "";
  if (key.startsWith("creem_test_")) return TEST_API_ORIGIN;
  return LIVE_API_ORIGIN;
}

export function collectUserControlledPrompts(input: {
  prompt?: unknown;
  baseStyle?: unknown;
  detailTypes?: unknown;
}): string[] {
  const prompts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) prompts.push(trimmed);
  };

  push(input.prompt);
  push(input.baseStyle);

  if (Array.isArray(input.detailTypes)) {
    for (const item of input.detailTypes) {
      if (!item || typeof item !== "object") continue;
      const record = item as { prompt?: unknown; key?: unknown };
      if (typeof record.prompt !== "string") continue;
      const trimmed = record.prompt.trim();
      if (!trimmed) continue;
      if (typeof record.key === "string" && trimmed === record.key.trim()) continue;
      prompts.push(trimmed);
    }
  }

  return prompts;
}

/** Remove known static templates so Creem only sees text the user actually controls. */
export function reduceToUserText(text: string, fragments: readonly string[]): string {
  let rest = text.trim();
  if (!rest) return "";

  const unique = [
    ...new Set(
      fragments
        .map((fragment) => fragment.trim())
        .filter((fragment) => fragment.length >= MIN_FRAGMENT_LENGTH),
    ),
  ].sort((a, b) => b.length - a.length);

  for (const fragment of unique) {
    if (rest.includes(fragment)) rest = rest.split(fragment).join(" ");
  }

  return rest.replace(/\s+/g, " ").replace(/^[\s—–|\-.,;:]+|[\s—–|\-.,;:]+$/g, "").trim();
}

export function promptsForModeration(
  input: { prompt?: unknown; baseStyle?: unknown; detailTypes?: unknown },
  fragments: readonly string[],
): string[] {
  const reduced = collectUserControlledPrompts(input)
    .map((text) => reduceToUserText(text, fragments))
    .map((text) => text.trim())
    .filter(Boolean);
  return [...new Set(reduced)];
}

export async function screenGenerationPrompts(input: {
  userId: string;
  prompts: readonly string[];
  env?: Env;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ModerationGate> {
  const env = readEnv(input.env);
  if (creemModerationMode(env) === "off") {
    return { allowed: true, decision: "skipped" };
  }

  const prompts = [...new Set(input.prompts.map((prompt) => prompt.trim()).filter(Boolean))];
  if (prompts.length === 0) {
    return { allowed: true, decision: "skipped" };
  }

  const apiKey = env.CREEM_API_KEY?.trim();
  if (!apiKey) {
    return { allowed: false, decision: "error" };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = creemApiBaseUrl(env);

  for (let index = 0; index < prompts.length; index += 1) {
    const result = await screenOne({
      fetchImpl,
      apiKey,
      url: `${base}${MODERATION_PATH}`,
      prompt: prompts[index],
      externalId: `user_${input.userId}:p_${index}`,
      timeoutMs,
    });
    if (!result.allowed) return result;
  }

  return { allowed: true, decision: "allow" };
}

async function screenOne(input: {
  fetchImpl: typeof fetch;
  apiKey: string;
  url: string;
  prompt: string;
  externalId: string;
  timeoutMs: number;
}): Promise<ModerationGate> {
  try {
    const res = await input.fetchImpl(input.url, {
      method: "POST",
      headers: {
        "x-api-key": input.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        external_id: input.externalId,
      }),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
    if (!res.ok) return { allowed: false, decision: "error" };
    const json = (await res.json()) as { decision?: unknown };
    if (json.decision === "allow") return { allowed: true, decision: "allow" };
    if (json.decision === "deny" || json.decision === "flag") {
      return { allowed: false, decision: json.decision };
    }
    return { allowed: false, decision: "error" };
  } catch {
    return { allowed: false, decision: "error" };
  }
}

export function moderationHttpResponse(gate: ModerationGate): NextResponse | null {
  if (gate.allowed) return null;
  if (gate.decision === "deny" || gate.decision === "flag") {
    return NextResponse.json(
      {
        error: "prompt_rejected",
        message:
          "Your prompt was rejected because it violates our content policy. Please revise and try again.",
      },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      error: "moderation_unavailable",
      message: "Content moderation is temporarily unavailable. Please try again shortly.",
    },
    { status: 503 },
  );
}
