import "server-only";

import { getBillingProvider, type BillingProvider } from "@/lib/billing/provider";
import { createCreemCheckout } from "@/lib/creem/client";
import type { BillingInterval, PaidPlanTier } from "@/lib/creem/products";
import { createCheckoutSession } from "@/lib/lemonsqueezy/billing";

export interface StartCheckoutInput {
  userId: string;
  email?: string | null;
  name?: string | null;
  planTier: string;
  interval?: string;
}

export interface StartCheckoutResult {
  url: string;
  sessionId: string;
  provider: BillingProvider;
}

function parsePlan(planTier: string): PaidPlanTier | null {
  if (planTier === "PRO" || planTier === "BUSINESS") return planTier;
  return null;
}

function parseInterval(interval: string | undefined): BillingInterval {
  return interval === "annual" ? "annual" : "monthly";
}

function lemonVariantId(tier: PaidPlanTier, interval: BillingInterval): string | null {
  const annual =
    tier === "PRO"
      ? process.env.LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID
      : process.env.LEMONSQUEEZY_BUSINESS_ANNUAL_VARIANT_ID;
  const monthly =
    tier === "PRO"
      ? process.env.LEMONSQUEEZY_PRO_VARIANT_ID || process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_VARIANT_ID
      : process.env.LEMONSQUEEZY_BUSINESS_VARIANT_ID ||
        process.env.NEXT_PUBLIC_LEMONSQUEEZY_BUSINESS_VARIANT_ID;
  const value = (interval === "annual" ? annual || monthly : monthly)?.trim();
  return value || null;
}

export async function startBillingCheckout(
  input: StartCheckoutInput
): Promise<StartCheckoutResult> {
  const planTier = parsePlan(input.planTier);
  if (!planTier) {
    throw new Error("planTier must be PRO or BUSINESS");
  }
  const interval = parseInterval(input.interval);
  const provider = getBillingProvider();

  if (provider === "creem") {
    const session = await createCreemCheckout({
      userId: input.userId,
      email: input.email,
      name: input.name,
      planTier,
      interval,
    });
    return { ...session, provider };
  }

  const variantId = lemonVariantId(planTier, interval);
  if (!variantId) {
    throw new Error("Lemon Squeezy variant id is not set");
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const session = await createCheckoutSession({
    userId: input.userId,
    variantId,
    planTier,
    successUrl: `${base}/settings/billing?success=true`,
    cancelUrl: `${base}/settings/billing?canceled=true`,
  });
  return { ...session, provider };
}
