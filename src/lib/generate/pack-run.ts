import { PACK_RUN_LOCK_MS } from "@/lib/generate/pack-timing";

const PACK_KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

export function normalizePackIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (!PACK_KEY_PATTERN.test(key)) return null;
  return key;
}

export interface PackLockRow {
  activePackKey?: string | null;
  activePackStartedAt?: Date | string | null;
  activePackSettled?: boolean | null;
}

/**
 * Same key always joins, even after the handler stored the images.
 * A different key starts only when the previous click has settled or the
 * lock window (the Hobby function limit) has passed.
 */
export function evaluatePackLock(row: PackLockRow, key: string, now: number): "start" | "join" {
  const current = typeof row.activePackKey === "string" && row.activePackKey ? row.activePackKey : null;
  if (!current) return "start";
  if (current === key) return "join";
  if (row.activePackSettled === true) return "start";
  const started = row.activePackStartedAt ? new Date(row.activePackStartedAt).getTime() : Number.NaN;
  const fresh = Number.isFinite(started) && now - started < PACK_RUN_LOCK_MS;
  if (!fresh) return "start";
  return "join";
}

export interface PackLockStore {
  findProject(imageProjectId: string): Promise<(PackLockRow & { userId?: string | null }) | null>;
  claim(input: {
    imageProjectId: string;
    userId: string;
    previousKey: string | null;
    previousSettled: boolean;
    idempotencyKey: string;
    now: Date;
  }): Promise<number>;
}

export type PackClaim = "start" | "join" | "missing";

/**
 * Claim this click or join the pack that already owns it.
 * The conditional update matches the key we just read, so a second request
 * that loses the row update does not start its own pack.
 */
export async function claimProjectPack(
  store: PackLockStore,
  input: { imageProjectId: string; userId: string; idempotencyKey: string; now?: number },
): Promise<PackClaim> {
  const now = input.now ?? Date.now();
  const project = await store.findProject(input.imageProjectId);
  if (!project || project.userId !== input.userId) return "missing";
  const decision = evaluatePackLock(project, input.idempotencyKey, now);
  if (decision === "join") return "join";
  const won = await store.claim({
    imageProjectId: input.imageProjectId,
    userId: input.userId,
    previousKey: project.activePackKey ?? null,
    previousSettled: project.activePackSettled === true,
    idempotencyKey: input.idempotencyKey,
    now: new Date(now),
  });
  return won === 1 ? "start" : "join";
}
