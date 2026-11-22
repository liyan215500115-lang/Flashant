export interface PackCreditFailure {
  key: string;
  reason: string;
  charged: boolean;
  creditsRefunded: boolean;
}

/** Stored on each shot of a pack so a refresh can rebuild this run's debit summary. */
export interface PackCreditRecord {
  id: string;
  finishedAt: string;
  requested: number;
  completed: number;
  creditsCharged: number;
  creditsRefunded: number;
  creditsNotCharged: number;
  failed: PackCreditFailure[];
}

interface ImageWithMeta {
  status?: string;
  url?: string | null;
  createdAt?: string;
  generationMeta?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readPackCredit(meta: unknown): PackCreditRecord | null {
  const record = asRecord(meta);
  const credit = asRecord(record?.packCredit);
  if (!credit) return null;
  if (typeof credit.id !== "string" || typeof credit.finishedAt !== "string") return null;
  if (typeof credit.requested !== "number" || typeof credit.completed !== "number") return null;
  const failed = Array.isArray(credit.failed)
    ? credit.failed.flatMap((item) => {
        const shot = asRecord(item);
        if (!shot || typeof shot.key !== "string") return [];
        return [{
          key: shot.key,
          reason: typeof shot.reason === "string" ? shot.reason : "",
          charged: shot.charged === true,
          creditsRefunded: shot.creditsRefunded === true,
        }];
      })
    : [];
  return {
    id: credit.id,
    finishedAt: credit.finishedAt,
    requested: credit.requested,
    completed: credit.completed,
    creditsCharged: typeof credit.creditsCharged === "number" ? credit.creditsCharged : 0,
    creditsRefunded: typeof credit.creditsRefunded === "number" ? credit.creditsRefunded : 0,
    creditsNotCharged: typeof credit.creditsNotCharged === "number" ? credit.creditsNotCharged : 0,
    failed,
  };
}

export function packIdFromMeta(meta: unknown): string | null {
  const record = asRecord(meta);
  return typeof record?.packId === "string" ? record.packId : null;
}

/** Newest finished pack. Images from the same run share one record. */
export function latestPackCredit(images: readonly ImageWithMeta[]): PackCreditRecord | null {
  let best: PackCreditRecord | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const image of images) {
    const credit = readPackCredit(image.generationMeta);
    if (!credit) continue;
    const time = Date.parse(credit.finishedAt);
    if (!Number.isFinite(time)) continue;
    if (time >= bestTime) {
      best = credit;
      bestTime = time;
    }
  }
  return best;
}
