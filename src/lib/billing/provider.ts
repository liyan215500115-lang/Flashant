import "server-only";

export type BillingProvider = "creem" | "lemonsqueezy";

/**
 * Kill switch for the merchant of record.
 *
 * BILLING_PROVIDER=creem arms Creem and disables Lemon Squeezy checkout plus
 * Lemon webhook mutations. Any other value, including unset, keeps Lemon so
 * existing preview environments do not switch by accident.
 */
export function getBillingProvider(): BillingProvider {
  const raw = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  if (raw === "creem") return "creem";
  return "lemonsqueezy";
}

export function isCreemArmed(): boolean {
  return getBillingProvider() === "creem";
}
