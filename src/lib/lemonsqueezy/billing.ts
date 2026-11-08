import "server-only";

import { isCreemArmed } from "@/lib/billing/provider";
import { db } from "@/lib/db";
import type { PlanTier } from "@prisma/client";

export {
  checkGenerationQuota,
  getQuota,
  getUsedGenerationCount,
  getUserQuota,
  planDisplayName,
  resolveEffectivePlan,
} from "@/lib/billing/quota";

// ── Types ────────────────────────────────────────────────────────────────

interface CheckoutOptions {
  userId: string;
  variantId: string;
  planTier: PlanTier;
  successUrl: string;
  cancelUrl: string;
}

interface CheckoutSession {
  url: string;
  sessionId: string;
}

// ── Lemon Squeezy Checkout ───────────────────────────────────────────────

export async function createCheckoutSession(
  options: CheckoutOptions
): Promise<CheckoutSession> {
  if (isCreemArmed()) {
    throw new Error("Lemon Squeezy is disabled while BILLING_PROVIDER=creem");
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY is not set");
  }

  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!storeId) {
    throw new Error("LEMONSQUEEZY_STORE_ID is not set");
  }

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          custom: { user_id: options.userId },
        },
        product_options: {
          redirect_url: options.successUrl,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: options.variantId } },
      },
    },
  };

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lemon Squeezy API error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const checkoutUrl = json.data?.attributes?.url;
  const checkoutId = json.data?.id;

  if (!checkoutUrl) {
    throw new Error("Lemon Squeezy: no checkout URL in response");
  }

  return { url: checkoutUrl, sessionId: checkoutId };
}

// ── Webhook Event Handler ────────────────────────────────────────────────

export async function handleSubscriptionEvent(event: {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    attributes: {
      customer_id?: number;
      variant_id?: number;
      status?: string;
      first_subscription_item?: {
        id: number;
        price_id: number;
      };
      renewed_at?: string;
      ends_at?: string;
      cancelled?: boolean;
    };
  };
}): Promise<"handled" | "skipped"> {
  const eventName = event.meta?.event_name;
  const userId = event.meta?.custom_data?.user_id;
  if (!userId) return "skipped";

  switch (eventName) {
    case "order_created": {
      const attrs = event.data.attributes;
      const subItemId = String(attrs.first_subscription_item?.id ?? event.data.id);
      const priceId = String(attrs.first_subscription_item?.price_id ?? attrs.variant_id ?? "");

      await db.subscription.upsert({
        where: { userId },
        update: {
          billingSubscriptionId: subItemId,
          billingCustomerId: attrs.customer_id ? String(attrs.customer_id) : null,
          billingPriceId: priceId,
          planTier: "PRO",
          status: "ACTIVE",
          currentPeriodStart: attrs.renewed_at ? new Date(attrs.renewed_at) : new Date(),
          currentPeriodEnd: attrs.ends_at ? new Date(attrs.ends_at) : undefined,
          cancelAtPeriodEnd: false,
        },
        create: {
          userId,
          billingSubscriptionId: subItemId,
          billingCustomerId: attrs.customer_id ? String(attrs.customer_id) : null,
          billingPriceId: priceId,
          planTier: "PRO",
          status: "ACTIVE",
          currentPeriodStart: attrs.renewed_at ? new Date(attrs.renewed_at) : new Date(),
          currentPeriodEnd: attrs.ends_at ? new Date(attrs.ends_at) : undefined,
        },
      });
      return "handled";
    }

    case "subscription_updated": {
      const attrs = event.data.attributes;
      await db.subscription.updateMany({
        where: { billingSubscriptionId: String(event.data.id) },
        data: {
          status: attrs.cancelled ? "CANCELED" : "ACTIVE",
          currentPeriodStart: attrs.renewed_at ? new Date(attrs.renewed_at) : undefined,
          currentPeriodEnd: attrs.ends_at ? new Date(attrs.ends_at) : undefined,
        },
      });
      return "handled";
    }

    case "subscription_cancelled": {
      await db.subscription.updateMany({
        where: { billingSubscriptionId: String(event.data.id) },
        data: { status: "CANCELED", planTier: "FREE" },
      });
      return "handled";
    }

    default:
      return "skipped";
  }
}
