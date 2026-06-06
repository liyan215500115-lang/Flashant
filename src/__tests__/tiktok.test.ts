import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  storeTikTokConnection,
  getTikTokToken,
  publishToTikTokShop,
} from "@/lib/platform/tiktok";

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
  encryptMock.mockImplementation((token: string) => `encrypted:${token}`);
  decryptMock.mockImplementation((token: string) => {
    if (!token || !token.startsWith("encrypted:")) return null;
    return token.slice("encrypted:".length);
  });
});

describe("storeTikTokConnection", () => {
  it("encrypts tokens and upserts platform connection", async () => {
    dbMock.platformConnection.upsert.mockResolvedValue({ id: "pc_tt_1" });

    await storeTikTokConnection("user_1", "My TikTok Store", {
      accessToken: "tt_access123",
      refreshToken: "tt_refresh456",
      sellerId: "seller_789",
    });

    expect(encryptMock).toHaveBeenCalledWith("tt_access123");
    expect(encryptMock).toHaveBeenCalledWith("tt_refresh456");

    expect(dbMock.platformConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_platform: { userId: "user_1", platform: "TIKTOK_SHOP" } },
        create: expect.objectContaining({
          platform: "TIKTOK_SHOP",
          platformStoreName: "My TikTok Store",
          platformUserId: "seller_789",
          accessTokenEncrypted: "encrypted:tt_access123",
          refreshTokenEncrypted: "encrypted:tt_refresh456",
        }),
        update: expect.objectContaining({
          isActive: true,
        }),
      })
    );
  });

  it("handles tokens without optional fields", async () => {
    dbMock.platformConnection.upsert.mockResolvedValue({ id: "pc_tt_2" });

    await storeTikTokConnection("user_2", "Simple Shop", {
      accessToken: "tt_simple",
    });

    expect(dbMock.platformConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          platformStoreName: "Simple Shop",
          accessTokenEncrypted: "encrypted:tt_simple",
          refreshTokenEncrypted: null,
        }),
      })
    );
  });
});

describe("getTikTokToken", () => {
  it("returns decrypted access token and seller id", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_tt_1",
      platformStoreName: "My TikTok Store",
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:tt_access123",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    const result = await getTikTokToken("user_1");

    expect(result).toEqual({
      accessToken: "tt_access123",
      sellerId: "seller_789",
    });
  });

  it("returns null when no connection exists", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue(null);

    const result = await getTikTokToken("user_none");

    expect(result).toBeNull();
  });

  it("returns null when platformStoreName is missing", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_bad",
      platformStoreName: null,
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    const result = await getTikTokToken("user_bad");

    expect(result).toBeNull();
  });

  it("refreshes token when expired and returns new token", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_expired",
      platformStoreName: "My TikTok Store",
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:old_token",
      refreshTokenEncrypted: "encrypted:refresh_xyz",
      tokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      isActive: true,
    });

    process.env.TIKTOK_CLIENT_ID = "tt_client_123";
    process.env.TIKTOK_CLIENT_SECRET = "tt_secret_456";

    const refreshMock = mockFetch(200, {
      access_token: "tt_new_token",
      scope: "seller.product.write",
    });
    vi.stubGlobal("fetch", refreshMock);

    const result = await getTikTokToken("user_expired");

    expect(result).toEqual({
      accessToken: "tt_new_token",
      sellerId: "seller_789",
    });

    const [url] = refreshMock.mock.calls[0];
    expect(url).toContain("auth.tiktok-shops.com/api/v2/token/refresh");

    delete process.env.TIKTOK_CLIENT_ID;
    delete process.env.TIKTOK_CLIENT_SECRET;
  });

  it("returns null when refresh fails and marks connection inactive", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_bad_refresh",
      platformStoreName: "My TikTok Store",
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:old_token",
      refreshTokenEncrypted: "encrypted:bad_refresh",
      tokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      isActive: true,
    });

    process.env.TIKTOK_CLIENT_ID = "tt_client_123";
    process.env.TIKTOK_CLIENT_SECRET = "tt_secret_456";

    vi.stubGlobal("fetch", mockFetch(400, { error: "invalid_grant" }));

    const result = await getTikTokToken("user_bad_refresh");

    expect(result).toBeNull();
    expect(dbMock.platformConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pc_bad_refresh" },
        data: expect.objectContaining({ isActive: false }),
      })
    );

    delete process.env.TIKTOK_CLIENT_ID;
    delete process.env.TIKTOK_CLIENT_SECRET;
  });
});

describe("publishToTikTokShop", () => {
  it("publishes product and returns post details", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_tt_1",
      platformStoreName: "My TikTok Store",
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:tt_access123",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    const mock = mockFetch(200, {
      data: { product_id: "tt_prod_1729" },
    });
    vi.stubGlobal("fetch", mock);

    const result = await publishToTikTokShop("user_1", {
      title: "Cool Sneakers",
      description: "Fresh kicks",
      images: [
        { url: "https://example.com/img1.png" },
        { url: "https://example.com/img2.png", alt: "side view" },
      ],
    });

    expect(result).toEqual({
      postId: "tt_prod_1729",
      postUrl: expect.stringContaining("seller.tiktokglobalshop.com/product/tt_prod_1729"),
    });

    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("https://open-api.tiktokglobalshop.com/api/products");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer tt_access123");

    const body = JSON.parse(init.body);
    expect(body.product_name).toBe("Cool Sneakers");
    expect(body.description).toBe("Fresh kicks");
    expect(body.main_images).toHaveLength(2);
  });

  it("marks connection inactive and returns null on 401", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_bad",
      platformStoreName: "badstore",
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:bad_token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    vi.stubGlobal("fetch", mockFetch(401, { errors: "Invalid token" }));

    const result = await publishToTikTokShop("user_1", {
      title: "Test",
      images: [{ url: "https://example.com/img.png" }],
    });

    expect(result).toBeNull();
    expect(dbMock.platformConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", platform: "TIKTOK_SHOP" },
        data: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it("throws on non-401 HTTP errors", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_tt_1",
      platformStoreName: "My TikTok Store",
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:valid_token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    vi.stubGlobal("fetch", mockFetch(429, { errors: "Rate limit exceeded" }));

    await expect(
      publishToTikTokShop("user_1", {
        title: "Test",
        images: [{ url: "https://example.com/img.png" }],
      })
    ).rejects.toThrow("TikTok API error");
  });

  it("throws when fetch fails entirely (network error)", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue({
      id: "pc_tt_1",
      platformStoreName: "My TikTok Store",
      platformUserId: "seller_789",
      accessTokenEncrypted: "encrypted:valid_token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      isActive: true,
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    await expect(
      publishToTikTokShop("user_1", {
        title: "Test",
        images: [{ url: "https://example.com/img.png" }],
      })
    ).rejects.toThrow("Network error");
  });

  it("returns null when no token is available", async () => {
    dbMock.platformConnection.findUnique.mockResolvedValue(null);

    const result = await publishToTikTokShop("unknown_user", {
      title: "Test",
      images: [{ url: "https://example.com/img.png" }],
    });

    expect(result).toBeNull();
  });
});
