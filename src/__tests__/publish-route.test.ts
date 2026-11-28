import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const publishToShopify = vi.hoisted(() => vi.fn());
const publishToTikTokShop = vi.hoisted(() => vi.fn());
const getSignedGetUrl = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({
  imageProject: { findUnique: vi.fn(), update: vi.fn() },
  publishRecord: { create: vi.fn() },
  platformConnection: { findUnique: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/s3", () => ({ getSignedGetUrl }));
vi.mock("@/lib/platform/shopify", () => ({ publishToShopify }));
vi.mock("@/lib/platform/tiktok", () => ({ publishToTikTokShop }));

import { GET, POST } from "@/app/api/publish/route";

function post(body: unknown) {
  return POST(new Request("https://flashant.test/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.S3_PUBLIC_URL;
  auth.mockResolvedValue({ user: { id: "user_1" } });
  db.imageProject.update.mockResolvedValue({});
  db.publishRecord.create.mockResolvedValue({});
  publishToShopify.mockResolvedValue({ postId: "99", postUrl: "https://admin.shopify.com/store/mystore/products/99" });
  getSignedGetUrl.mockResolvedValue("https://signed.example/generated/lifestyle.png?X-Amz-Signature=abc");
});

describe("publish route", () => {
  it("reports whether a Shopify store is connected", async () => {
    db.platformConnection.findUnique.mockResolvedValueOnce({ isActive: true, platformStoreName: "mystore" });
    const connected = await GET();
    expect(await connected.json()).toMatchObject({ shopifyConnected: true, shopName: "mystore" });

    db.platformConnection.findUnique.mockResolvedValueOnce(null);
    const missing = await GET();
    expect(await missing.json()).toMatchObject({ shopifyConnected: false });
  });

  it("signs an owned object instead of sending the storage key or an expired provider URL", async () => {
    db.imageProject.findUnique.mockResolvedValue({
      id: "proj_1",
      userId: "user_1",
      title: "乳液",
      generatedImages: [{
        id: "img_1",
        status: "SUCCEEDED",
        url: "https://replicate.delivery/pbxt/old.png",
        s3Key: "generated/lifestyle.png",
        createdAt: new Date("2026-11-20T00:00:00.000Z"),
      }],
    });

    const res = await post({
      imageProjectId: "proj_1",
      generatedImageIds: ["img_1"],
      platforms: ["SHOPIFY"],
    });
    expect(res.status).toBe(200);
    expect(getSignedGetUrl).toHaveBeenCalledWith("generated/lifestyle.png", 3600);
    const payload = publishToShopify.mock.calls[0][1];
    expect(payload.images[0].url).toBe("https://signed.example/generated/lifestyle.png?X-Amz-Signature=abc");
    expect(payload.images[0].url).not.toContain("replicate.delivery");
    expect(payload.images[0].url).not.toBe("generated/lifestyle.png");
  });

  it("does not publish an expired provider URL when no owned file exists", async () => {
    db.imageProject.findUnique.mockResolvedValue({
      id: "proj_1",
      userId: "user_1",
      title: "乳液",
      generatedImages: [{
        id: "img_old",
        status: "SUCCEEDED",
        url: "https://replicate.delivery/pbxt/old.png",
        s3Key: "https://replicate.delivery/pbxt/old.png",
        createdAt: new Date("2026-11-20T00:00:00.000Z"),
      }],
    });

    const res = await post({
      imageProjectId: "proj_1",
      generatedImageIds: ["img_old"],
      platforms: ["SHOPIFY"],
    });
    const body = await res.json();
    expect(publishToShopify).not.toHaveBeenCalled();
    expect(body.results[0]).toMatchObject({
      status: "failed",
      error: "Image is not a public URL the shop can fetch",
    });
  });

  it("publishes a configured public object URL without signing", async () => {
    process.env.S3_PUBLIC_URL = "https://cdn.flashant.test";
    db.imageProject.findUnique.mockResolvedValue({
      id: "proj_1",
      userId: "user_1",
      title: "乳液",
      generatedImages: [{
        id: "img_1",
        status: "SUCCEEDED",
        url: "https://cdn.flashant.test/generated/lifestyle.png",
        s3Key: "generated/lifestyle.png",
        createdAt: new Date("2026-11-20T00:00:00.000Z"),
      }],
    });

    await post({
      imageProjectId: "proj_1",
      generatedImageIds: ["img_1"],
      platforms: ["SHOPIFY"],
    });
    expect(getSignedGetUrl).not.toHaveBeenCalled();
    expect(publishToShopify.mock.calls[0][1].images[0].url).toBe(
      "https://cdn.flashant.test/generated/lifestyle.png",
    );
    delete process.env.S3_PUBLIC_URL;
  });
});
