import "server-only";

import type { PlanTier } from "@prisma/client";

export type PaidPlanTier = "PRO" | "BUSINESS";
export type BillingInterval = "monthly" | "annual";

type ProductEnv = {
  name: string;
  tier: PaidPlanTier;
};

const PRODUCT_ENV_VARS: ProductEnv[] = [
  { name: "CREEM_PRODUCT_ID_PRO_MONTHLY", tier: "PRO" },
  { name: "CREEM_PRODUCT_ID_PRO_ANNUAL", tier: "PRO" },
  { name: "CREEM_PRODUCT_ID_PRO", tier: "PRO" },
  { name: "CREEM_PRODUCT_ID_BUSINESS_MONTHLY", tier: "BUSINESS" },
  { name: "CREEM_PRODUCT_ID_BUSINESS_ANNUAL", tier: "BUSINESS" },
  { name: "CREEM_PRODUCT_ID_BUSINESS", tier: "BUSINESS" },
];

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function planTierForCreemProduct(productId: string): PlanTier | null {
  for (const row of PRODUCT_ENV_VARS) {
    if (readEnv(row.name) === productId) return row.tier;
  }
  return null;
}

export function creemProductIdForPlan(
  tier: PaidPlanTier,
  interval: BillingInterval
): string | null {
  if (tier === "PRO" && interval === "annual") {
    return readEnv("CREEM_PRODUCT_ID_PRO_ANNUAL");
  }
  if (tier === "PRO") {
    return readEnv("CREEM_PRODUCT_ID_PRO_MONTHLY") ?? readEnv("CREEM_PRODUCT_ID_PRO");
  }
  if (interval === "annual") {
    return readEnv("CREEM_PRODUCT_ID_BUSINESS_ANNUAL");
  }
  return readEnv("CREEM_PRODUCT_ID_BUSINESS_MONTHLY") ?? readEnv("CREEM_PRODUCT_ID_BUSINESS");
}

export function creemAnnualProductsConfigured(): boolean {
  return Boolean(
    readEnv("CREEM_PRODUCT_ID_PRO_ANNUAL") && readEnv("CREEM_PRODUCT_ID_BUSINESS_ANNUAL")
  );
}
