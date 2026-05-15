import { db } from "@/lib/db";
import type { PlanTier } from "@prisma/client";

interface StripeCheckoutOptions {
  userId: string;
  priceId: string;
  planTier: PlanTier;
  successUrl: string;
  cancelUrl: string;
}

interface StripeSession {
  url: string;
  sessionId: string;
}

const TIER_LIMITS: Record<PlanTier, { generationsPerMonth: number; platforms: number }> = {
  FREE: { generationsPerMonth: 10, platforms: 1 },
  PRO: { generationsPerMonth: 100, platforms: 2 },
  BUSINESS: { generationsPerMonth: 500, platforms: 4 },
  ENTERPRISE: { generationsPerMonth: -1, platforms: 4 }, // -1 = unlimited
};

export function getQuota(planTier: PlanTier) {
  return TIER_LIMITS[planTier] ?? TIER_LIMITS.FREE;
}

export async function getUserQuota(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId } });
  const tier = sub?.planTier ?? "FREE";
  return getQuota(tier);
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

export async function checkGenerationQuota(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  tier: PlanTier;
}> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  const tier = sub?.planTier ?? "FREE";
  const limits = getQuota(tier);

  if (limits.generationsPerMonth === -1) {
    return { allowed: true, used: 0, limit: -1, tier };
  }

  const periodStart = sub?.currentPeriodStart ?? new Date(0);
  const used = await getUsedGenerationCount(userId, periodStart);

  return {
    allowed: used < limits.generationsPerMonth,
    used,
    limit: limits.generationsPerMonth,
    tier,
  };
}

export async function createCheckoutSession(
  options: StripeCheckoutOptions
): Promise<StripeSession> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "line_items[0][price]": options.priceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      "metadata[userId]": options.userId,
      "metadata[planTier]": options.planTier,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { url: data.url, sessionId: data.id };
}

export async function handleSubscriptionEvent(event: {
  type: string;
  data: {
    object: {
      id: string;
      customer: string;
      metadata?: Record<string, string>;
      items?: { data: { price: { id: string } }[] };
      current_period_start?: number;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      status?: string;
    };
  };
}): Promise<"handled" | "skipped"> {
  const obj = event.data.object;
  const userId = obj.metadata?.userId;
  if (!userId) return "skipped";

  switch (event.type) {
    case "checkout.session.completed": {
      const priceId = obj.items?.data[0]?.price.id;
      const planTier = obj.metadata?.planTier as PlanTier;

      await db.subscription.upsert({
        where: { userId },
        update: {
          stripeSubscriptionId: obj.id,
          stripeCustomerId: obj.customer,
          stripePriceId: priceId,
          planTier: planTier ?? "PRO",
          status: "ACTIVE",
          currentPeriodStart: obj.current_period_start
            ? new Date(obj.current_period_start * 1000)
            : undefined,
          currentPeriodEnd: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : undefined,
          cancelAtPeriodEnd: false,
        },
        create: {
          userId,
          stripeSubscriptionId: obj.id,
          stripeCustomerId: obj.customer,
          stripePriceId: priceId,
          planTier: planTier ?? "PRO",
          status: "ACTIVE",
          currentPeriodStart: obj.current_period_start
            ? new Date(obj.current_period_start * 1000)
            : undefined,
          currentPeriodEnd: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : undefined,
        },
      });
      return "handled";
    }

    case "customer.subscription.updated": {
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: obj.id },
        data: {
          status: obj.status === "active" ? "ACTIVE" : "PAST_DUE",
          currentPeriodStart: obj.current_period_start
            ? new Date(obj.current_period_start * 1000)
            : undefined,
          currentPeriodEnd: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : undefined,
          cancelAtPeriodEnd: obj.cancel_at_period_end ?? false,
        },
      });
      return "handled";
    }

    case "customer.subscription.deleted": {
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: obj.id },
        data: { status: "CANCELED", planTier: "FREE" },
      });
      return "handled";
    }

    default:
      return "skipped";
  }
}
