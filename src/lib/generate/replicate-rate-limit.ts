const RATE_LIMIT_PATTERN = /\b429\b|too many requests|rate limit|throttl/i;
const RETRY_AFTER_PATTERN = /retry_after(?:"\s*)?\s*[:=]\s*"?(\d+(?:\.\d+)?)/i;

/** Used when a 429 does not name retry_after. Matches the 1–3s window seen in production. */
const DEFAULT_RETRY_AFTER_MS = 2_000;
const MIN_RETRY_AFTER_MS = 1_000;
const MAX_RETRY_AFTER_MS = 60_000;

export function isReplicateRateLimit(error: unknown): boolean {
  const message = errorText(error);
  return Boolean(message) && RATE_LIMIT_PATTERN.test(message);
}

/**
 * Milliseconds to wait before retrying the same request.
 * Returns null when the error is not a rate limit.
 * Replicate sends retry_after in seconds, either in the JSON body or the Retry-After header.
 */
export function replicateRetryDelayMs(error: unknown): number | null {
  const message = errorText(error);
  if (!message || !RATE_LIMIT_PATTERN.test(message)) return null;
  const match = message.match(RETRY_AFTER_PATTERN);
  const seconds = match ? Number(match[1]) : DEFAULT_RETRY_AFTER_MS / 1000;
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(MIN_RETRY_AFTER_MS, Math.round(seconds * 1000)));
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}
