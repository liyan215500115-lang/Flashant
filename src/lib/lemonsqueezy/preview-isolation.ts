// Preview isolation for the Lemon test-payment path.
// The production Neon host is already recorded in CODEX.md. It is a host
// marker, not a credential. Preview must never grant entitlements there.

export const PRODUCTION_DATABASE_HOST_MARKER = "ep-lingering-unit-ahm7ojop";

export function isKnownProductionDatabase(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  return databaseUrl.includes(PRODUCTION_DATABASE_HOST_MARKER);
}

export type CheckoutGate =
  | { allow: true; testMode: boolean }
  | { allow: false; status: number; reason: string };

export function evaluateCheckoutGate(env: {
  vercelEnv: string | undefined;
  previewBillingArmed: string | undefined;
  databaseUrl: string | undefined;
}): CheckoutGate {
  if (env.vercelEnv !== "preview") {
    return { allow: true, testMode: false };
  }

  if (isKnownProductionDatabase(env.databaseUrl)) {
    return {
      allow: false,
      status: 409,
      reason: "preview_checkout_blocked_production_database",
    };
  }
  if (!env.databaseUrl) {
    return {
      allow: false,
      status: 409,
      reason: "preview_checkout_blocked_database_unset",
    };
  }
  if (env.previewBillingArmed !== "1") {
    return {
      allow: false,
      status: 409,
      reason: "preview_checkout_blocked_not_armed",
    };
  }

  return { allow: true, testMode: true };
}

export type WebhookGate =
  | { action: "grant" }
  | { action: "skip"; reason: string }
  | { action: "refuse"; status: number; reason: string };

export function evaluateWebhookGate(env: {
  vercelEnv: string | undefined;
  previewBillingArmed: string | undefined;
  databaseUrl: string | undefined;
  testMode: boolean;
}): WebhookGate {
  if (env.vercelEnv === "production") {
    if (env.testMode) {
      return { action: "skip", reason: "test_event_ignored_on_production" };
    }
    return { action: "grant" };
  }

  if (isKnownProductionDatabase(env.databaseUrl)) {
    return { action: "skip", reason: "production_database_locked" };
  }

  if (env.vercelEnv === "preview") {
    if (!env.testMode) {
      return { action: "skip", reason: "live_event_ignored_on_preview" };
    }
    if (!env.databaseUrl) {
      return { action: "refuse", status: 503, reason: "preview_database_unset" };
    }
    if (env.previewBillingArmed !== "1") {
      return { action: "refuse", status: 503, reason: "preview_billing_not_armed" };
    }
    return { action: "grant" };
  }

  return { action: "grant" };
}

export function checkoutBaseUrl(env: {
  vercelEnv: string | undefined;
  vercelUrl: string | undefined;
  appUrl: string | undefined;
}): string {
  if (env.vercelEnv === "preview" && env.vercelUrl) {
    const host = env.vercelUrl.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return env.appUrl || "http://localhost:3000";
}
