import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getQuota,
  checkGenerationQuota,
  createCheckoutSession,
  handleSubscriptionEvent,
} from "@/lib/stripe/billing";

// ── Mock db (hoisted so vi.mock factory can reference it) ──────────────
const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    generatedImage: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

// ── Helpers ──────────────────────────────────────────────────────────────
function mockFetch(status: number, data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── getQuota ─────────────────────────────────────────────────────────────
describe("getQuota", () => {
  it("returns FREE limits (10 generations, 1 platform)", () => {
    const q = getQuota("FREE");
    expect(q.generationsPerMonth).toBe(10);
    expect(q.platforms).toBe(1);
  });

  it("returns PRO limits", () => {
    const q = getQuota("PRO");
    expect(q.generationsPerMonth).toBeGreaterThan(10);
  });

  it("returns BUSINESS limits", () => {
    const q = getQuota("BUSINESS");
    expect(q.generationsPerMonth).toBeGreaterThan(
      getQuota("PRO").generationsPerMonth
    );
  });

  it("returns ENTERPRISE limits (-1 = unlimited)", () => {
    const q = getQuota("ENTERPRISE");
    expect(q.generationsPerMonth).toBe(-1);
  });

  it("falls back to FREE for unknown tier", () => {
    const q = getQuota("UNKNOWN" as "FREE");
    expect(q).toEqual(getQuota("FREE"));
  });
});

// ── checkGenerationQuota ─────────────────────────────────────────────────
describe("checkGenerationQuota", () => {
  it("allows when usage is below limit", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({
      planTier: "PRO",
      currentPeriodStart: new Date("2026-05-01"),
    });
    dbMock.generatedImage.count.mockResolvedValue(15);

    const result = await checkGenerationQuota("user_1");

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(15);
  });

  it("blocks when usage has reached limit", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({
      planTier: "FREE",
      currentPeriodStart: new Date("2026-05-01"),
    });
    dbMock.generatedImage.count.mockResolvedValue(10);

    const result = await checkGenerationQuota("user_2");

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(10);
    expect(result.limit).toBe(10);
    expect(result.tier).toBe("FREE");
  });

  it("always allows ENTERPRISE (unlimited)", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({
      planTier: "ENTERPRISE",
      currentPeriodStart: new Date("2026-05-01"),
    });

    const result = await checkGenerationQuota("user_3");

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(-1);
  });

  it("defaults to FREE tier when no subscription exists", async () => {
    dbMock.subscription.findUnique.mockResolvedValue(null);
    dbMock.generatedImage.count.mockResolvedValue(0);

    const result = await checkGenerationQuota("user_4");

    expect(result.tier).toBe("FREE");
    expect(result.limit).toBe(10);
    expect(result.allowed).toBe(true);
  });
});

// ── createCheckoutSession ────────────────────────────────────────────────
describe("createCheckoutSession", () => {
  it("returns session URL and ID on success", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    const mock = mockFetch(200, { url: "https://checkout.stripe.com/pay/cs_test", id: "cs_abc" });
    vi.stubGlobal("fetch", mock);

    const result = await createCheckoutSession({
      userId: "user_1",
      priceId: "price_abc",
      planTier: "PRO",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result.url).toBe("https://checkout.stripe.com/pay/cs_test");
    expect(result.sessionId).toBe("cs_abc");

    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.method).toBe("POST");
  });

  it("throws when STRIPE_SECRET_KEY is missing", async () => {
    const original = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;

    await expect(
      createCheckoutSession({
        userId: "user_1",
        priceId: "price_abc",
        planTier: "PRO",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      })
    ).rejects.toThrow("STRIPE_SECRET_KEY");

    process.env.STRIPE_SECRET_KEY = original;
  });

  it("throws on Stripe API error", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    vi.stubGlobal("fetch", mockFetch(400, { error: { message: "Bad request" } }));

    await expect(
      createCheckoutSession({
        userId: "user_1",
        priceId: "bad_price",
        planTier: "PRO",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      })
    ).rejects.toThrow("Stripe API error");
  });
});

// ── handleSubscriptionEvent ──────────────────────────────────────────────
describe("handleSubscriptionEvent", () => {
  it("skips event with no userId in metadata", async () => {
    const result = await handleSubscriptionEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          metadata: {},
        },
      },
    });

    expect(result).toBe("skipped");
    expect(dbMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("handles checkout.session.completed — upserts ACTIVE subscription", async () => {
    const result = await handleSubscriptionEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "sub_abc",
          customer: "cus_abc",
          metadata: { userId: "user_1", planTier: "PRO" },
          items: { data: [{ price: { id: "price_xyz" } }] },
          current_period_start: 1715700000,
          current_period_end: 1718380000,
        },
      },
    });

    expect(result).toBe("handled");
    expect(dbMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        create: expect.objectContaining({
          planTier: "PRO",
          status: "ACTIVE",
          stripeSubscriptionId: "sub_abc",
          stripeCustomerId: "cus_abc",
          stripePriceId: "price_xyz",
        }),
      })
    );
  });

  it("handles checkout.session.completed — defaults planTier to PRO when missing", async () => {
    await handleSubscriptionEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "sub_def",
          customer: "cus_def",
          metadata: { userId: "user_2" },
          items: { data: [{ price: { id: "price_def" } }] },
          current_period_start: 1715700000,
          current_period_end: 1718380000,
        },
      },
    });

    expect(dbMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ planTier: "PRO" }),
      })
    );
  });

  it("handles customer.subscription.updated — sets ACTIVE status", async () => {
    dbMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleSubscriptionEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_ghi",
          customer: "cus_ghi",
          metadata: { userId: "user_3" },
          status: "active",
        },
      },
    });

    expect(result).toBe("handled");
    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_ghi" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("handles customer.subscription.updated — sets PAST_DUE status", async () => {
    dbMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    await handleSubscriptionEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_past_due",
          customer: "cus_pd",
          metadata: { userId: "user_4" },
          status: "past_due",
        },
      },
    });

    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAST_DUE" }),
      })
    );
  });

  it("handles customer.subscription.deleted — sets CANCELED + FREE", async () => {
    dbMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleSubscriptionEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_del",
          customer: "cus_del",
          metadata: { userId: "user_5" },
        },
      },
    });

    expect(result).toBe("handled");
    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_del" },
        data: { status: "CANCELED", planTier: "FREE" },
      })
    );
  });

  it("skips unknown event types", async () => {
    const result = await handleSubscriptionEvent({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_123",
          customer: "cus_123",
          metadata: { userId: "user_6" },
        },
      },
    });

    expect(result).toBe("skipped");
  });
});
