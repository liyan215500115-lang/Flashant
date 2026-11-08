import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkGenerationQuota, resolveEffectivePlan } from "@/lib/billing/quota";
import { createCreemCheckout, creemApiBaseUrl } from "@/lib/creem/client";
import { screenGenerationPrompts } from "@/lib/creem/moderation";
import { verifyCreemSignature } from "@/lib/creem/signature";
import { handleCreemWebhookEvent } from "@/lib/creem/webhook";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    billingWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    generatedImage: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

const CREEM_ENV = [
  "BILLING_PROVIDER",
  "CREEM_API_KEY",
  "CREEM_TEST_MODE",
  "CREEM_API_BASE_URL",
  "CREEM_PRODUCT_ID_PRO_MONTHLY",
  "CREEM_PRODUCT_ID_BUSINESS_MONTHLY",
  "CREEM_SUCCESS_URL",
  "CREEM_MODERATION",
] as const;

function clearCreemEnv() {
  for (const key of CREEM_ENV) delete process.env[key];
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  clearCreemEnv();
  dbMock.billingWebhookEvent.findUnique.mockResolvedValue(null);
  dbMock.billingWebhookEvent.create.mockResolvedValue({ id: "evt" });
  dbMock.subscription.findUnique.mockResolvedValue(null);
  dbMock.subscription.findFirst.mockResolvedValue(null);
  dbMock.subscription.upsert.mockResolvedValue({});
  dbMock.subscription.updateMany.mockResolvedValue({ count: 1 });
  dbMock.generatedImage.count.mockResolvedValue(0);
});

describe("verifyCreemSignature", () => {
  it("accepts an HMAC-SHA256 hex digest of the raw body", () => {
    const body = JSON.stringify({ id: "evt_1", eventType: "subscription.paid" });
    const signature = createHmac("sha256", "whsec_test").update(body).digest("hex");
    expect(verifyCreemSignature(body, signature, "whsec_test")).toBe(true);
  });

  it("rejects a missing or mismatched signature", () => {
    expect(verifyCreemSignature("{}", null, "whsec_test")).toBe(false);
    expect(verifyCreemSignature("{}", "abc", "whsec_test")).toBe(false);
    expect(verifyCreemSignature("{}", "ab", undefined)).toBe(false);
  });
});

describe("checkGenerationQuota plan tier", () => {
  it("reports the stored Pro plan instead of Enterprise", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({
      planTier: "PRO",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-06-01"),
    });
    dbMock.generatedImage.count.mockResolvedValue(4);

    const result = await checkGenerationQuota("user_pro");
    expect(result.tier).toBe("PRO");
    expect(result.limit).toBe(100);
    expect(result.used).toBe(4);
    expect(result.allowed).toBe(true);
  });

  it("keeps a canceled plan until the period ends, then returns Free", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({
      planTier: "BUSINESS",
      status: "CANCELED",
      cancelAtPeriodEnd: true,
      currentPeriodStart: new Date("2026-06-01"),
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    dbMock.generatedImage.count.mockResolvedValue(2);

    const active = await checkGenerationQuota("user_biz");
    expect(active.tier).toBe("BUSINESS");
    expect(active.limit).toBe(600);

    dbMock.subscription.findUnique.mockResolvedValue({
      planTier: "BUSINESS",
      status: "CANCELED",
      cancelAtPeriodEnd: true,
      currentPeriodStart: new Date("2026-05-01"),
      currentPeriodEnd: new Date(Date.now() - 1000),
    });
    const ended = await checkGenerationQuota("user_biz");
    expect(ended.tier).toBe("FREE");
    expect(ended.limit).toBe(10);
  });
});

describe("resolveEffectivePlan", () => {
  it("does not invent Enterprise for a Pro row", () => {
    expect(resolveEffectivePlan({ planTier: "PRO", status: "ACTIVE" })).toBe("PRO");
    expect(resolveEffectivePlan(null)).toBe("FREE");
  });
});

describe("createCreemCheckout", () => {
  it("posts to the test API with the server-side product id", async () => {
    process.env.BILLING_PROVIDER = "creem";
    process.env.CREEM_API_KEY = "creem_test_key";
    process.env.CREEM_TEST_MODE = "true";
    process.env.CREEM_PRODUCT_ID_PRO_MONTHLY = "prod_pro";
    process.env.CREEM_SUCCESS_URL = "https://preview.example/settings/billing?success=true";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "ch_1", checkout_url: "https://creem.io/test/ch_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCreemCheckout({
      userId: "user_1",
      email: "seller@example.com",
      name: "Yan",
      planTier: "PRO",
      interval: "monthly",
    });

    expect(result).toEqual({ url: "https://creem.io/test/ch_1", sessionId: "ch_1" });
    expect(creemApiBaseUrl()).toBe("https://test-api.creem.io/v1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test-api.creem.io/v1/checkouts");
    expect(init.headers["x-api-key"]).toBe("creem_test_key");
    const body = JSON.parse(init.body);
    expect(body.product_id).toBe("prod_pro");
    expect(body.success_url).toBe("https://preview.example/settings/billing?success=true");
    expect(body.metadata.referenceId).toBe("user_1");
    expect(body.metadata.user_id).toBe("user_1");
    expect(body.customer.email).toBe("seller@example.com");
  });

  it("stays disabled until BILLING_PROVIDER=creem", async () => {
    process.env.CREEM_API_KEY = "creem_test_key";
    process.env.CREEM_PRODUCT_ID_PRO_MONTHLY = "prod_pro";
    await expect(
      createCreemCheckout({
        userId: "user_1",
        planTier: "PRO",
        interval: "monthly",
      })
    ).rejects.toThrow("BILLING_PROVIDER=creem");
  });
});

describe("handleCreemWebhookEvent", () => {
  beforeEach(() => {
    process.env.CREEM_PRODUCT_ID_PRO_MONTHLY = "prod_pro";
    process.env.CREEM_PRODUCT_ID_BUSINESS_MONTHLY = "prod_business";
  });

  it("activates Pro from subscription.paid", async () => {
    const result = await handleCreemWebhookEvent({
      id: "evt_paid",
      eventType: "subscription.paid",
      created_at: Date.parse("2026-06-01T00:00:00Z"),
      object: {
        id: "sub_123",
        object: "subscription",
        product: { id: "prod_pro" },
        customer: { id: "cust_1" },
        metadata: { referenceId: "user_1" },
        current_period_start_date: "2026-06-01T00:00:00.000Z",
        current_period_end_date: "2026-07-01T00:00:00.000Z",
      },
    });

    expect(result).toBe("handled");
    expect(dbMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        create: expect.objectContaining({
          planTier: "PRO",
          status: "ACTIVE",
          billingProvider: "creem",
          billingSubscriptionId: "sub_123",
          billingCustomerId: "cust_1",
          billingPriceId: "prod_pro",
        }),
      })
    );
  });

  it("activates Business from checkout.completed", async () => {
    const result = await handleCreemWebhookEvent({
      id: "evt_checkout",
      eventType: "checkout.completed",
      created_at: Date.parse("2026-06-02T00:00:00Z"),
      object: {
        id: "ch_9",
        object: "checkout",
        product: { id: "prod_business" },
        customer: { id: "cust_9" },
        metadata: { referenceId: "user_9" },
        subscription: {
          id: "sub_9",
          current_period_start_date: "2026-06-02T00:00:00.000Z",
          current_period_end_date: "2026-07-02T00:00:00.000Z",
        },
      },
    });

    expect(result).toBe("handled");
    expect(dbMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user_9",
          planTier: "BUSINESS",
          billingSubscriptionId: "sub_9",
        }),
      })
    );
  });

  it("ignores a duplicate event id", async () => {
    dbMock.billingWebhookEvent.findUnique.mockResolvedValue({ id: "evt_paid" });
    const result = await handleCreemWebhookEvent({
      id: "evt_paid",
      eventType: "subscription.paid",
      created_at: Date.now(),
      object: { id: "sub_123", product: { id: "prod_pro" }, metadata: { referenceId: "user_1" } },
    });
    expect(result).toBe("duplicate");
    expect(dbMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("does not let an older event overwrite a newer plan", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({
      billingEventAt: new Date("2026-08-01T00:00:00Z"),
    });
    const result = await handleCreemWebhookEvent({
      id: "evt_old",
      eventType: "subscription.paid",
      created_at: Date.parse("2026-07-01T00:00:00Z"),
      object: {
        id: "sub_123",
        product: { id: "prod_business" },
        metadata: { referenceId: "user_1" },
      },
    });
    expect(result).toBe("stale");
    expect(dbMock.subscription.upsert).not.toHaveBeenCalled();
    expect(dbMock.billingWebhookEvent.create).toHaveBeenCalled();
  });

  it("keeps access on cancel until the period ends", async () => {
    const result = await handleCreemWebhookEvent({
      id: "evt_cancel",
      eventType: "subscription.canceled",
      created_at: Date.now(),
      object: {
        id: "sub_123",
        product: { id: "prod_pro" },
        metadata: { user_id: "user_1" },
        current_period_end_date: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(result).toBe("handled");
    const data = dbMock.subscription.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("CANCELED");
    expect(data.cancelAtPeriodEnd).toBe(true);
    expect(data.planTier).toBeUndefined();
  });

  it("marks past_due without dropping the tier", async () => {
    await handleCreemWebhookEvent({
      id: "evt_due",
      eventType: "subscription.past_due",
      created_at: Date.now(),
      object: {
        id: "sub_123",
        metadata: { referenceId: "user_1" },
      },
    });
    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAST_DUE" }),
      })
    );
    const data = dbMock.subscription.updateMany.mock.calls[0][0].data;
    expect(data.planTier).toBeUndefined();
  });

  it("downgrades to Free when the subscription expires", async () => {
    await handleCreemWebhookEvent({
      id: "evt_expired",
      eventType: "subscription.expired",
      created_at: Date.now(),
      object: {
        id: "sub_123",
        metadata: { referenceId: "user_1" },
      },
    });
    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELED", planTier: "FREE", cancelAtPeriodEnd: false }),
      })
    );
  });

  it("refuses to grant a plan for an unknown product id", async () => {
    await expect(
      handleCreemWebhookEvent({
        id: "evt_unknown_product",
        eventType: "subscription.active",
        created_at: Date.now(),
        object: {
          id: "sub_x",
          product: { id: "prod_not_configured" },
          metadata: { referenceId: "user_1" },
        },
      })
    ).rejects.toThrow("CREEM_PRODUCT_ID_");
    expect(dbMock.billingWebhookEvent.create).not.toHaveBeenCalled();
  });
});

describe("screenGenerationPrompts", () => {
  it("does nothing until CREEM_MODERATION=enforce", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await screenGenerationPrompts({ userId: "user_1", prompts: ["a red shoe"] });
    expect(result).toEqual({ allowed: true, decision: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks generation when Creem returns deny", async () => {
    process.env.CREEM_MODERATION = "enforce";
    process.env.CREEM_API_KEY = "creem_test_key";
    process.env.CREEM_TEST_MODE = "true";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ decision: "deny" }),
      })
    );
    const result = await screenGenerationPrompts({ userId: "user_1", prompts: ["banned prompt"] });
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("deny");
  });
});
