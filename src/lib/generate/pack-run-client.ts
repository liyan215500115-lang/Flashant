import { latestPackCredit, packIdFromMeta, type PackCreditRecord } from "@/lib/generate/pack-credit";
import { formatPackCreditSummaryFromPayload, packFailureReasonLabel } from "@/lib/generate/pack-summary";
import { workbenchEngineFromShots } from "@/lib/generate/engine-label";

const DISCONNECT_PATTERN = /failed to fetch|network\s*error|networkerror|connection closed|err_connection|aborted|load failed|timeout/i;

/** Browser fetch failed before a JSON body arrived. The server may still be finishing the pack. */
export function isPackRequestDisconnect(error: unknown): boolean {
  if (!error) return false;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "AbortError") return true;
  if (error instanceof SyntaxError) return true;
  return DISCONNECT_PATTERN.test(message);
}

export function createPackIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export interface PackProjectImage {
  id?: string;
  status?: string;
  url?: string | null;
  createdAt?: string;
  aiProvider?: string | null;
  modelVersion?: string | null;
  generationMeta?: unknown;
}

export interface PackProjectSnapshot {
  status?: string;
  generatedImages?: PackProjectImage[];
}

export interface PackRunView {
  credit: PackCreditRecord;
  summary: string;
  failures: Array<{ key: string; reason: string }>;
  successes: Array<{ key: string; url: string; label: string; id?: string }>;
  engine: { engine: "vega" | "flux"; label: string };
}

export function packRunViewFromImages(
  images: readonly PackProjectImage[],
  locale?: string,
): PackRunView | null {
  const credit = latestPackCredit(images);
  if (!credit) return null;
  const mine = images.filter((image) => packIdFromMeta(image.generationMeta) === credit.id);
  const successes = mine.flatMap((image) => {
    if (image.status !== "SUCCEEDED" || !image.url) return [];
    const meta = image.generationMeta;
    const key = meta && typeof meta === "object" && "detailKey" in meta && typeof meta.detailKey === "string"
      ? meta.detailKey
      : "detail";
    return [{ key, url: image.url, label: key, ...(image.id ? { id: image.id } : {}) }];
  });
  return {
    credit,
    summary: formatPackCreditSummaryFromPayload(credit, {
      requested: credit.requested,
      completed: credit.completed,
    }, locale),
    failures: credit.failed.map((shot) => ({
      key: shot.key,
      reason: packFailureReasonLabel(shot.reason || "生成失败", locale),
    })),
    successes,
    engine: workbenchEngineFromShots(mine.length > 0 ? mine : images),
  };
}

const CLOCK_SKEW_MS = 3_000;

function finishedAtMs(view: PackRunView | null): number {
  if (!view) return Number.NaN;
  return Date.parse(view.credit.finishedAt);
}

/**
 * After the generate POST connection drops, keep reading the project until this
 * run's persisted credit summary is visible or the wait is over.
 * A summary written before this click is not this order. While the project is
 * still GENERATING, only a summary timestamped at or after the click counts.
 */
export async function pollPackUntilSettled(options: {
  startedAt: number;
  fetchProject: () => Promise<PackProjectSnapshot>;
  locale?: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  intervalMs?: number;
  timeoutMs?: number;
  maxSteps?: number;
}): Promise<PackRunView | null> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const intervalMs = options.intervalMs ?? 3_000;
  const timeoutMs = options.timeoutMs ?? 330_000;
  const deadline = now() + timeoutMs;
  const maxSteps = options.maxSteps ?? Math.ceil(timeoutMs / intervalMs) + 2;
  let sawGenerating = false;
  let idleTerminalPolls = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    if (now() > deadline) break;
    let snapshot: PackProjectSnapshot;
    try {
      snapshot = await options.fetchProject();
    } catch {
      if (now() >= deadline) break;
      await sleep(intervalMs);
      continue;
    }

    if (snapshot.status === "GENERATING") {
      sawGenerating = true;
      idleTerminalPolls = 0;
    }

    const view = packRunViewFromImages(snapshot.generatedImages ?? [], options.locale);
    const finishedAt = finishedAtMs(view);
    const afterClick = Number.isFinite(finishedAt) && finishedAt >= options.startedAt - CLOCK_SKEW_MS;
    if (view && afterClick && (snapshot.status !== "GENERATING" || finishedAt >= options.startedAt)) {
      return view;
    }

    if (!sawGenerating && snapshot.status && snapshot.status !== "GENERATING") {
      idleTerminalPolls += 1;
      if (idleTerminalPolls >= 3) return null;
    }

    if (now() >= deadline) break;
    await sleep(intervalMs);
  }

  return null;
}

/**
 * A dropped POST is recovered by polling images that are already written.
 * `resubmit` is accepted so callers can pass the original POST and tests can
 * prove this path never invokes it.
 */
export async function onPackPostDisconnect(options: {
  error: unknown;
  poll: () => Promise<PackRunView | null>;
  resubmit?: () => Promise<unknown>;
}): Promise<{ resubmitted: false; view: PackRunView | null }> {
  if (!isPackRequestDisconnect(options.error)) {
    throw options.error;
  }
  const view = await options.poll();
  return { resubmitted: false, view };
}
