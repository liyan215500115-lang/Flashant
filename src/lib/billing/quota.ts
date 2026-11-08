import "server-only";

import { db } from "@/lib/db";
import type { PlanTier } from "@prisma/client";

const TIER_LIMITS: Record<PlanTier, { generationsPerMonth: number; platforms: number }> = {
  FREE: { generationsPerMonth: 10, platforms: 0 },
  PRO: { generationsPerMonth: 100, platforms: 1 },
  BUSINESS: { generationsPerMonth: 600, platforms: 1 },
  ENTERPRISE: { generationsPerMonth: -1, platforms: 4 },
};

type PlanSnapshot = {
  planTier: PlanTier;
  status?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
} | null;

export function getQuota(planTier: PlanTier) {
  return TIER_LIMITS[planTier] ?? TIER_LIMITS.FREE;
}

/**
 * Plan the product should enforce and display.
 * Paid access continues through the current period after a scheduled cancel.
 * A canceled subscription with no remaining period is Free, which keeps
 * /api/quota and the billing page on the same tier.
 */
export function resolveEffectivePlan(sub: PlanSnapshot): PlanTier {
  if (!sub) return "FREE";
  if (sub.planTier === "FREE") return "FREE";

  const status = sub.status ?? "ACTIVE";
  if (status === "UNPAID" || status === "INCOMPLETE_EXPIRED") return "FREE";

  if (status === "CANCELED") {
    const end = sub.currentPeriodEnd?.getTime();
    if (sub.cancelAtPeriodEnd && end && end > Date.now()) return sub.planTier;
    return "FREE";
  }

  return sub.planTier;
}

export function planDisplayName(tier: string): string {
  switch (tier) {
    case "PRO":
      return "Pro";
    case "BUSINESS":
      return "Business";
    case "ENTERPRISE":
      return "Enterprise";
    default:
      return "Free";
  }
}

export async function getUserQuota(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId } });
  return getQuota(resolveEffectivePlan(sub));
}

export async function getUsedGenerationCount(
  userId: string,
  periodStart: Date
): Promise<number> {
  const count = await db.generatedImage.count({
    where: {
      project: { userId },
      createdAt: { gte: periodStart },
    },
  });
  return count;
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function checkGenerationQuota(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  tier: PlanTier;
}> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  const tier = resolveEffectivePlan(sub);
  const quota = getQuota(tier);

  if (quota.generationsPerMonth < 0) {
    return { allowed: true, used: 0, limit: -1, tier };
  }

  const periodStart = sub?.currentPeriodStart ?? startOfUtcMonth(new Date());
  const used = await getUsedGenerationCount(userId, periodStart);
  return {
    allowed: used < quota.generationsPerMonth,
    used,
    limit: quota.generationsPerMonth,
    tier,
  };
}
