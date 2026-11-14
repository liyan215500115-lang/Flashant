import { describe, it, expect } from "vitest";
import {
  checkoutBaseUrl,
  evaluateCheckoutGate,
  evaluateWebhookGate,
  isKnownProductionDatabase,
  PRODUCTION_DATABASE_HOST_MARKER,
} from "@/lib/lemonsqueezy/preview-isolation";

const PROD_URL = `postgresql://user:pw@${PRODUCTION_DATABASE_HOST_MARKER}-pooler.us-east-2.aws.neon.tech/flashant`;
const PREVIEW_URL = "postgresql://user:pw@ep-preview-branch-pooler.us-east-2.aws.neon.tech/flashant";

describe("isKnownProductionDatabase", () => {
  it("matches the recorded production Neon host", () => {
    expect(isKnownProductionDatabase(PROD_URL)).toBe(true);
  });

  it("does not match a different host", () => {
    expect(isKnownProductionDatabase(PREVIEW_URL)).toBe(false);
    expect(isKnownProductionDatabase(undefined)).toBe(false);
  });
});

describe("evaluateCheckoutGate", () => {
  it("leaves non-preview checkouts on the live path", () => {
    expect(
      evaluateCheckoutGate({
        vercelEnv: "production",
        previewBillingArmed: "1",
        databaseUrl: PROD_URL,
      })
    ).toEqual({ allow: true, testMode: false });
  });

  it("blocks preview checkout against the production database", () => {
    const gate = evaluateCheckoutGate({
      vercelEnv: "preview",
      previewBillingArmed: "1",
      databaseUrl: PROD_URL,
    });
    expect(gate.allow).toBe(false);
    if (!gate.allow) expect(gate.reason).toBe("preview_checkout_blocked_production_database");
  });

  it("blocks preview checkout until the arm flag is set", () => {
    const gate = evaluateCheckoutGate({
      vercelEnv: "preview",
      previewBillingArmed: undefined,
      databaseUrl: PREVIEW_URL,
    });
    expect(gate.allow).toBe(false);
  });

  it("allows an armed preview checkout only in test mode", () => {
    expect(
      evaluateCheckoutGate({
        vercelEnv: "preview",
        previewBillingArmed: "1",
        databaseUrl: PREVIEW_URL,
      })
    ).toEqual({ allow: true, testMode: true });
  });
});

describe("evaluateWebhookGate", () => {
  it("grants live events on production", () => {
    expect(
      evaluateWebhookGate({
        vercelEnv: "production",
        previewBillingArmed: undefined,
        databaseUrl: PROD_URL,
        testMode: false,
      })
    ).toEqual({ action: "grant" });
  });

  it("does not grant test events on production", () => {
    expect(
      evaluateWebhookGate({
        vercelEnv: "production",
        previewBillingArmed: "1",
        databaseUrl: PROD_URL,
        testMode: true,
      })
    ).toEqual({ action: "skip", reason: "test_event_ignored_on_production" });
  });

  it("does not grant onto the production database from preview", () => {
    expect(
      evaluateWebhookGate({
        vercelEnv: "preview",
        previewBillingArmed: "1",
        databaseUrl: PROD_URL,
        testMode: true,
      })
    ).toEqual({ action: "skip", reason: "production_database_locked" });
  });

  it("refuses preview test events until billing is armed", () => {
    const gate = evaluateWebhookGate({
      vercelEnv: "preview",
      previewBillingArmed: undefined,
      databaseUrl: PREVIEW_URL,
      testMode: true,
    });
    expect(gate).toEqual({
      action: "refuse",
      status: 503,
      reason: "preview_billing_not_armed",
    });
  });

  it("grants an armed preview test event on a non-production database", () => {
    expect(
      evaluateWebhookGate({
        vercelEnv: "preview",
        previewBillingArmed: "1",
        databaseUrl: PREVIEW_URL,
        testMode: true,
      })
    ).toEqual({ action: "grant" });
  });

  it("ignores live events on preview", () => {
    expect(
      evaluateWebhookGate({
        vercelEnv: "preview",
        previewBillingArmed: "1",
        databaseUrl: PREVIEW_URL,
        testMode: false,
      })
    ).toEqual({ action: "skip", reason: "live_event_ignored_on_preview" });
  });
});

describe("checkoutBaseUrl", () => {
  it("keeps production on NEXT_PUBLIC_APP_URL", () => {
    expect(
      checkoutBaseUrl({
        vercelEnv: "production",
        vercelUrl: "flashant-abc.vercel.app",
        appUrl: "https://flashant.vercel.app",
      })
    ).toBe("https://flashant.vercel.app");
  });

  it("returns the preview deployment host", () => {
    expect(
      checkoutBaseUrl({
        vercelEnv: "preview",
        vercelUrl: "flashant-git-preview-qa-payment-suite.vercel.app",
        appUrl: "https://flashant.vercel.app",
      })
    ).toBe("https://flashant-git-preview-qa-payment-suite.vercel.app");
  });
});
