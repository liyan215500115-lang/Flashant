import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  storeShopifyConnection,
  getShopifyToken,
  publishToShopify,
} from "@/lib/platform/shopify";

// ── Mock token-manager (hoisted before vi.mock) ────────────────────────
const { encryptMock, decryptMock } = vi.hoisted(() => ({
  encryptMock: vi.fn((token: string) => `encrypted:${token}`),
  decryptMock: vi.fn((token: string) => {
    if (!token || !token.startsWith("encrypted:")) return null;
    return token.slice("encrypted:".length);
  }),
}));

vi.mock("@/lib/token-manager", () => ({
  encryptToken: (token: string) => encryptMock(token),
  decryptToken: (token: string) => decryptMock(token),
}));

// ── Mock db (hoisted before vi.mock) ───────────────────────────────────
const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    platformConnection: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
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
  // Re-mock encrypt/decrypt since restoreAllMocks wipes them
  encryptMock.mockImplementation((token: string) => `encrypted:${token}`);
  decryptMock.mockImplementation((token: string) => {
    if (!token || !token.startsWith("encrypted:")) return null;
    return token.slice("encrypted:".length);
  });
});

// ── storeShopifyConnection ───────────────────────────────────────────────
describe("storeShopifyConnection", () => {
  it("encrypts tokens and upserts platform connection", async () => {
    dbMock.platformConnection.upsert.mockResolvedValue({ id: "pc_1" });

    await storeShopifyConnection("user_1", "mystore", {
      accessToken: "shpat_access123",
      refreshToken: "shp_refresh456",
    });

    expect(encryptMock).toHaveBeenCalledWith("shpat_access123");
    expect(encryptMock).toHaveBeenCalledWith("shp_refresh456");

    expect(dbMock.platformConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_platform: { userId: "user_1", platform: "SHOPIFY" } },
        create: expect.objectContaining({
          platform: "SHOPIFY",
          platformStoreName: "mystore",
          accessTokenEncrypted: "encrypted:shpat_access123",
          refreshTokenEncrypted: "encrypted:shp_refresh456",
        }),
        update: expect.objectContaining({
          isActive: true,
          platformStoreName: "mystore",
        }),
      })
    );
  });

  it("handles tokens without optional fields", async () => {
    dbMock.platformConnection.upsert.mockResolvedValue({ id: "pc_2" });

    await storeShopifyConnection("user_2", "simple-store", {
      accessToken: "shpat_simple",
    });

    expect(dbMock.platformConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          platformStoreName: "simple-store",
          accessTokenEncrypted: "encrypted:shpat_simple",
          refreshTokenEncrypted: null,
        }),
      })
    );
  });
});

// ── getShopifyToken ──────────────────────────────────────────────────────
describe("getShopifyToken", () => {
  it("returns decrypted access token and store name", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_1",
      platformStoreName: "mystore",
      accessTokenEncrypted: "encrypted:shpat_access123",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    const result = await getShopifyToken("user_1");

    expect(result).toEqual({
      accessToken: "shpat_access123",
      storeName: "mystore",
    });
  });

  it("returns null when no connection exists", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue(null);

    const result = await getShopifyToken("user_none");

    expect(result).toBeNull();
  });

  it("returns null when platformStoreName is missing", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_bad",
      platformStoreName: null,
      accessTokenEncrypted: "encrypted:token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    const result = await getShopifyToken("user_bad");

    expect(result).toBeNull();
  });

  it("refreshes token when expired and returns new token", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_expired",
      platformStoreName: "mystore",
      accessTokenEncrypted: "encrypted:old_token",
      refreshTokenEncrypted: "encrypted:refresh_xyz",
      tokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      isActive: true,
    });

    process.env.SHOPIFY_CLIENT_ID = "client_123";
    process.env.SHOPIFY_CLIENT_SECRET = "secret_456";

    const refreshMock = mockFetch(200, {
      access_token: "shpat_new_token",
      scope: "write_products",
    });
    vi.stubGlobal("fetch", refreshMock);

    const result = await getShopifyToken("user_expired");

    expect(result).toEqual({
      accessToken: "shpat_new_token",
      storeName: "mystore",
    });

    const [url] = refreshMock.mock.calls[0];
    expect(url).toContain("mystore.myshopify.com/admin/oauth/access_token");

    delete process.env.SHOPIFY_CLIENT_ID;
    delete process.env.SHOPIFY_CLIENT_SECRET;
  });

  it("returns null when refresh fails and marks connection inactive", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_bad_refresh",
      platformStoreName: "mystore",
      accessTokenEncrypted: "encrypted:old_token",
      refreshTokenEncrypted: "encrypted:bad_refresh",
      tokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      isActive: true,
    });

    process.env.SHOPIFY_CLIENT_ID = "client_123";
    process.env.SHOPIFY_CLIENT_SECRET = "secret_456";

    vi.stubGlobal("fetch", mockFetch(400, { error: "invalid_grant" }));

    const result = await getShopifyToken("user_bad_refresh");

    expect(result).toBeNull();
    expect(dbMock.platformConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pc_bad_refresh" },
        data: expect.objectContaining({ isActive: false }),
      })
    );

    delete process.env.SHOPIFY_CLIENT_ID;
    delete process.env.SHOPIFY_CLIENT_SECRET;
  });
});

// ── publishToShopify ─────────────────────────────────────────────────────
describe("publishToShopify", () => {
  it("publishes product and returns post details", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_1",
      platformStoreName: "mystore",
      accessTokenEncrypted: "encrypted:shpat_access123",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    const mock = mockFetch(201, {
      product: {
        id: 9876543210,
        title: "Cool T-Shirt",
        images: [{ src: "https://cdn.shopify.com/img.png" }],
      },
    });
    vi.stubGlobal("fetch", mock);

    const result = await publishToShopify("user_1", {
      title: "Cool T-Shirt",
      description: "A very cool shirt",
      images: [
        { url: "https://example.com/img1.png" },
        { url: "https://example.com/img2.png", alt: "view 2" },
      ],
    });

    expect(result).toEqual({
      postId: "9876543210",
      postUrl: expect.stringContaining("admin.shopify.com/store/mystore/products/9876543210"),
    });

    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("https://mystore.myshopify.com/admin/api/2024-04/products.json");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Shopify-Access-Token"]).toBe("shpat_access123");

    const body = JSON.parse(init.body);
    expect(body.product.title).toBe("Cool T-Shirt");
    expect(body.product.images).toHaveLength(2);
  });

  it("marks connection inactive and returns null on 401", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_bad",
      platformStoreName: "badstore",
      accessTokenEncrypted: "encrypted:bad_token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    vi.stubGlobal("fetch", mockFetch(401, { errors: "Invalid API key" }));

    const result = await publishToShopify("user_1", {
      title: "Test",
      images: [{ url: "https://example.com/img.png" }],
    });

    expect(result).toBeNull();
    expect(dbMock.platformConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", platform: "SHOPIFY" },
        data: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it("throws on non-401 HTTP errors", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_1",
      platformStoreName: "mystore",
      accessTokenEncrypted: "encrypted:valid_token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    vi.stubGlobal("fetch", mockFetch(429, { errors: "Rate limit exceeded" }));

    await expect(
      publishToShopify("user_1", {
        title: "Test",
        images: [{ url: "https://example.com/img.png" }],
      })
    ).rejects.toThrow("Shopify API error");
  });

  it("throws when fetch fails entirely (network error)", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_1",
      platformStoreName: "mystore",
      accessTokenEncrypted: "encrypted:valid_token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    await expect(
      publishToShopify("user_1", {
        title: "Test",
        images: [{ url: "https://example.com/img.png" }],
      })
    ).rejects.toThrow("Network error");
  });

  it("returns null when no token is available", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue(null);

    const result = await publishToShopify("unknown_user", {
      title: "Test",
      images: [{ url: "https://example.com/img.png" }],
    });

    expect(result).toBeNull();
  });
});
