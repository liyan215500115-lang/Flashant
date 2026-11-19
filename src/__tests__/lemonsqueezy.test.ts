import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getQuota,
  checkGenerationQuota,
  createCheckoutSession,
  handleSubscriptionEvent,
} from "@/lib/lemonsqueezy/billing";

// ── Mock db ──────────────────────────────────────────────────────────────
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
  it("returns FREE limits (10 generations, 0 platforms)", () => {
    const q = getQuota("FREE");
    expect(q.generationsPerMonth).toBe(10);
    expect(q.platforms).toBe(0);
  });

  it("returns PRO limits (100 generations, 1 platform)", () => {
    const q = getQuota("PRO");
    expect(q.generationsPerMonth).toBe(100);
    expect(q.platforms).toBe(1);
  });

  it("returns BUSINESS limits (600 generations, 1 platform)", () => {
    const q = getQuota("BUSINESS");
    expect(q.generationsPerMonth).toBe(600);
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
// The Creem generation wallet is the authority. Without an API key the read
// path must not fall back to the old unlimited ENTERPRISE stub or to a
// GeneratedImage count.
describe("checkGenerationQuota", () => {
  it("does not report the unlimited ENTERPRISE stub or count GeneratedImage rows", async () => {
    delete process.env.CREEM_API_KEY;
    process.env.CREEM_MODERATION = "enforce";
    dbMock.subscription.findUnique.mockResolvedValue(null);
    dbMock.generatedImage.count.mockResolvedValue(11);

    const result = await checkGenerationQuota("user_free");
    expect(result.tier).toBe("FREE");
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.tier).not.toBe("ENTERPRISE");
    expect(result.limit).not.toBe(-1);
    expect(dbMock.generatedImage.count).not.toHaveBeenCalled();
  });
});

// ── createCheckoutSession ────────────────────────────────────────────────
describe("createCheckoutSession", () => {
  it("returns checkout URL and ID on success", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "ls_key_123";
    process.env.LEMONSQUEEZY_STORE_ID = "store_1";

    const mock = mockFetch(201, {
      data: {
        id: "checkout_abc",
        attributes: { url: "https://flashant.lemonsqueezy.com/checkout/abc" },
      },
    });
    vi.stubGlobal("fetch", mock);

    const result = await createCheckoutSession({
      userId: "user_1",
      variantId: "variant_pro",
      planTier: "PRO",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result.url).toBe("https://flashant.lemonsqueezy.com/checkout/abc");
    expect(result.sessionId).toBe("checkout_abc");

    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("https://api.lemonsqueezy.com/v1/checkouts");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer ls_key_123");

    const body = JSON.parse(init.body);
    expect(body.data.type).toBe("checkouts");
    expect(body.data.relationships.variant.data.id).toBe("variant_pro");
    expect(body.data.relationships.store.data.id).toBe("store_1");

    delete process.env.LEMONSQUEEZY_API_KEY;
    delete process.env.LEMONSQUEEZY_STORE_ID;
  });

  it("throws when LEMONSQUEEZY_API_KEY is missing", async () => {
    await expect(
      createCheckoutSession({
        userId: "user_1",
        variantId: "v_1",
        planTier: "PRO",
        successUrl: "/success",
        cancelUrl: "/cancel",
      })
    ).rejects.toThrow("LEMONSQUEEZY_API_KEY");
  });

  it("throws when LEMONSQUEEZY_STORE_ID is missing", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "ls_key_123";
    await expect(
      createCheckoutSession({
        userId: "user_1",
        variantId: "v_1",
        planTier: "PRO",
        successUrl: "/success",
        cancelUrl: "/cancel",
      })
    ).rejects.toThrow("LEMONSQUEEZY_STORE_ID");
    delete process.env.LEMONSQUEEZY_API_KEY;
  });

  it("throws on LS API error", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "ls_key_123";
    process.env.LEMONSQUEEZY_STORE_ID = "store_1";
    vi.stubGlobal("fetch", mockFetch(422, { errors: [{ detail: "Invalid variant" }] }));

    await expect(
      createCheckoutSession({
        userId: "user_1",
        variantId: "bad_variant",
        planTier: "PRO",
        successUrl: "/success",
        cancelUrl: "/cancel",
      })
    ).rejects.toThrow("Lemon Squeezy API error");

    delete process.env.LEMONSQUEEZY_API_KEY;
    delete process.env.LEMONSQUEEZY_STORE_ID;
  });
});

// ── handleSubscriptionEvent ──────────────────────────────────────────────
describe("handleSubscriptionEvent", () => {
  it("skips event with no userId in custom_data", async () => {
    const result = await handleSubscriptionEvent({
      meta: { event_name: "order_created", custom_data: {} },
      data: { id: "sub_123", attributes: {} },
    });

    expect(result).toBe("skipped");
    expect(dbMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("handles order_created — upserts ACTIVE subscription", async () => {
    const result = await handleSubscriptionEvent({
      meta: {
        event_name: "order_created",
        custom_data: { user_id: "user_1" },
      },
      data: {
        id: "order_abc",
        attributes: {
          customer_id: 12345,
          variant_id: 678,
          first_subscription_item: { id: 200, price_id: 99 },
          renewed_at: "2026-06-01T00:00:00Z",
          ends_at: "2026-07-01T00:00:00Z",
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
          billingSubscriptionId: "200",
          billingCustomerId: "12345",
          billingPriceId: "99",
        }),
      })
    );
  });

  it("handles subscription_updated — sets status to ACTIVE", async () => {
    dbMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleSubscriptionEvent({
      meta: {
        event_name: "subscription_updated",
        custom_data: { user_id: "user_2" },
      },
      data: {
        id: "sub_item_500",
        attributes: {
          cancelled: false,
          renewed_at: "2026-06-01T00:00:00Z",
          ends_at: "2026-07-01T00:00:00Z",
        },
      },
    });

    expect(result).toBe("handled");
    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { billingSubscriptionId: "sub_item_500" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("handles subscription_updated — sets CANCELLED when cancelled=true", async () => {
    dbMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    await handleSubscriptionEvent({
      meta: {
        event_name: "subscription_updated",
        custom_data: { user_id: "user_3" },
      },
      data: {
        id: "sub_item_cancelling",
        attributes: { cancelled: true },
      },
    });

    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELED" }),
      })
    );
  });

  it("handles subscription_cancelled — sets CANCELED + FREE", async () => {
    dbMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleSubscriptionEvent({
      meta: {
        event_name: "subscription_cancelled",
        custom_data: { user_id: "user_4" },
      },
      data: { id: "sub_cancelled", attributes: {} },
    });

    expect(result).toBe("handled");
    expect(dbMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { billingSubscriptionId: "sub_cancelled" },
        data: { status: "CANCELED", planTier: "FREE" },
      })
    );
  });

  it("skips unknown event types", async () => {
    const result = await handleSubscriptionEvent({
      meta: {
        event_name: "license_key_created",
        custom_data: { user_id: "user_5" },
      },
      data: { id: "ev_999", attributes: {} },
    });

    expect(result).toBe("skipped");
  });
});
