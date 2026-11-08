import "server-only";

import { isCreemArmed } from "@/lib/billing/provider";
import {
  creemProductIdForPlan,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/creem/products";

export interface CreemCheckoutInput {
  userId: string;
  email?: string | null;
  name?: string | null;
  planTier: PaidPlanTier;
  interval: BillingInterval;
}

export interface CreemCheckoutResult {
  url: string;
  sessionId: string;
}

export function creemTestMode(): boolean {
  const flag = process.env.CREEM_TEST_MODE?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return (process.env.CREEM_API_KEY ?? "").includes("test");
}

/** Official Creem API origin plus /v1. Override with CREEM_API_BASE_URL. */
export function creemApiBaseUrl(): string {
  const override = process.env.CREEM_API_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return creemTestMode() ? "https://test-api.creem.io/v1" : "https://api.creem.io/v1";
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function creemSuccessUrl(): string {
  return process.env.CREEM_SUCCESS_URL?.trim() || `${appBaseUrl()}/settings/billing?success=true`;
}

/**
 * Creem's create-checkout body has success_url and no cancel_url.
 * CREEM_CANCEL_URL is the in-app page we document for an abandoned checkout.
 */
export function creemCancelUrl(): string {
  return process.env.CREEM_CANCEL_URL?.trim() || `${appBaseUrl()}/settings/billing?canceled=true`;
}

async function creemPost(path: string, body: unknown): Promise<Record<string, unknown>> {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) {
    throw new Error("CREEM_API_KEY is not set");
  }

  const res = await fetch(`${creemApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Creem API error: ${res.status} ${text}`);
  }

  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

export async function createCreemCheckout(
  input: CreemCheckoutInput
): Promise<CreemCheckoutResult> {
  if (!isCreemArmed()) {
    throw new Error("Creem checkout is disabled. Set BILLING_PROVIDER=creem");
  }

  const productId = creemProductIdForPlan(input.planTier, input.interval);
  if (!productId) {
    throw new Error(
      `Creem product id is not set for ${input.planTier} ${input.interval}. Set CREEM_PRODUCT_ID_*`
    );
  }

  const metadata: Record<string, string> = {
    referenceId: input.userId,
    user_id: input.userId,
    plan_tier: input.planTier,
    interval: input.interval,
  };

  const body: Record<string, unknown> = {
    product_id: productId,
    request_id: `${input.userId}:${input.planTier}:${input.interval}:${Date.now()}`,
    success_url: creemSuccessUrl(),
    metadata,
  };

  if (input.email) {
    body.customer = {
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
    };
  }

  const json = await creemPost("/checkouts", body);
  const url = typeof json.checkout_url === "string" ? json.checkout_url : null;
  const sessionId = typeof json.id === "string" ? json.id : "";
  if (!url) {
    throw new Error("Creem: no checkout URL in response");
  }
  return { url, sessionId };
}

export async function createCreemPortalLink(customerId: string): Promise<string> {
  if (!isCreemArmed()) {
    throw new Error("Creem portal is disabled. Set BILLING_PROVIDER=creem");
  }
  const json = await creemPost("/customers/billing", { customer_id: customerId });
  const url =
    (typeof json.customer_portal_link === "string" && json.customer_portal_link) ||
    (typeof json.customerPortalLink === "string" && json.customerPortalLink) ||
    "";
  if (!url) {
    throw new Error("Creem: no customer portal link in response");
  }
  return url;
}
