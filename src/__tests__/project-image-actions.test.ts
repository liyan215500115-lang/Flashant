import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";
import { imageDeleteConfirmCopy } from "@/lib/image-delete-copy";
import { translate } from "@/lib/translate";
import { PLATFORM_SPECS, PUBLISHABLE_PLATFORMS } from "@/lib/platform-specs";

const tZh = (key: string) => translate(zh, key);
const tEn = (key: string) => translate(en, key);

const { authMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: {
    imageProject: { findUnique: vi.fn() },
    productImage: { findFirst: vi.fn(), delete: vi.fn() },
    generatedImage: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/s3", () => ({ getSignedGetUrl: vi.fn() }));

import { POST as saveGenerated } from "@/app/api/products/[id]/generated/route";
import { DELETE as deleteImage } from "@/app/api/products/[id]/images/route";

function post(body: unknown) {
  return new Request("http://localhost/api/products/proj_1/generated", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("imageDeleteConfirmCopy", () => {
  it("uses the batch dialog copy without a derivative warning", () => {
    expect(imageDeleteConfirmCopy({ count: 3, removesDerivatives: false, t: tZh })).toEqual({
      title: "删除选中图片",
      description: "确定要删除选中的 3 张图片吗？此操作不可撤销。",
      confirmLabel: "删除 3 张",
    });
  });

  it("warns that deleting an original also removes its generated images", () => {
    const copy = imageDeleteConfirmCopy({ count: 1, removesDerivatives: true, t: tZh });
    expect(copy.title).toBe("删除图片");
    expect(copy.description).toContain("此操作不可撤销");
    expect(copy.description).toContain("由它生成的图片也会一并删除");
    expect(copy.confirmLabel).toBe("删除");
  });

  it("uses English copy when the workbench locale is English", () => {
    const copy = imageDeleteConfirmCopy({ count: 2, removesDerivatives: true, t: tEn });
    expect(copy.title).toBe("Delete selected images");
    expect(copy.description).toContain("Delete the 2 selected images?");
    expect(copy.description).toContain("also deletes the images generated from it");
    expect(copy.confirmLabel).toBe("Delete 2");
    expect(copy.description).not.toMatch(/删除/);
  });
});

describe("platform publish path", () => {
  it("keeps Shopify as the only one-click publish platform", () => {
    expect(PUBLISHABLE_PLATFORMS.map((spec) => spec.platform)).toEqual(["SHOPIFY"]);
    expect(PLATFORM_SPECS.TIKTOK_SHOP.publishable).toBe(false);
    expect(PLATFORM_SPECS.AMAZON.publishable).toBe(false);
  });
});

describe("save generated image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    dbMock.imageProject.findUnique.mockResolvedValue({ id: "proj_1", userId: "user_1" });
    dbMock.productImage.findFirst.mockResolvedValue({ id: "orig_1", imageProjectId: "proj_1" });
    dbMock.generatedImage.create.mockResolvedValue({ id: "gen_new" });
  });

  it("stores an edit as a new succeeded image and keeps the original id", async () => {
    const res = await saveGenerated(post({
      s3Key: "products/edited.png",
      url: "https://cdn.example/edited.png",
      productImageId: "orig_1",
      promptUsed: "manual-edit",
      fileSize: 1200,
      mimeType: "image/png",
    }), { params: Promise.resolve({ id: "proj_1" }) });

    expect(res.status).toBe(201);
    expect(dbMock.generatedImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imageProjectId: "proj_1",
        productImageId: "orig_1",
        s3Key: "products/edited.png",
        url: "https://cdn.example/edited.png",
        promptUsed: "manual-edit",
        aiProvider: "manual",
        status: "SUCCEEDED",
      }),
    });
    expect(dbMock.productImage.delete).not.toHaveBeenCalled();
  });

  it("rejects an edit whose original is not on this project", async () => {
    dbMock.productImage.findFirst.mockResolvedValue(null);
    const res = await saveGenerated(post({
      s3Key: "products/edited.png",
      url: "https://cdn.example/edited.png",
      productImageId: "other",
    }), { params: Promise.resolve({ id: "proj_1" }) });
    expect(res.status).toBe(400);
    expect(dbMock.generatedImage.create).not.toHaveBeenCalled();
  });
});

describe("delete project image", () => {
  const tx = {
    generatedImage: { updateMany: vi.fn() },
    productImage: { delete: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    dbMock.imageProject.findUnique.mockResolvedValue({ id: "proj_1", userId: "user_1" });
    dbMock.generatedImage.updateMany.mockResolvedValue({ count: 2 });
    dbMock.generatedImage.update.mockResolvedValue({});
    dbMock.productImage.delete.mockResolvedValue({});
    tx.generatedImage.updateMany.mockResolvedValue({ count: 2 });
    tx.productImage.delete.mockResolvedValue({});
    dbMock.$transaction.mockImplementation(async (run: (client: typeof tx) => Promise<unknown>) => run(tx));
  });

  it("disconnects generated rows before deleting the original", async () => {
    dbMock.productImage.findFirst.mockResolvedValue({ id: "orig_1" });
    const res = await deleteImage(
      new Request("http://localhost/api/products/proj_1/images", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId: "orig_1" }),
      }),
      { params: Promise.resolve({ id: "proj_1" }) }
    );

    expect(res.status).toBe(200);
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.generatedImage.updateMany).toHaveBeenCalledWith({
      where: { productImageId: "orig_1", imageProjectId: "proj_1" },
      data: { status: "DELETED", productImageId: null },
    });
    expect(tx.productImage.delete).toHaveBeenCalledWith({ where: { id: "orig_1" } });
    const updateOrder = tx.generatedImage.updateMany.mock.invocationCallOrder[0];
    const deleteOrder = tx.productImage.delete.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(deleteOrder);
    expect(dbMock.generatedImage.updateMany).not.toHaveBeenCalled();
    expect(dbMock.productImage.delete).not.toHaveBeenCalled();
  });

  it("soft-deletes a single generated image without touching other rows", async () => {
    dbMock.productImage.findFirst.mockResolvedValue(null);
    dbMock.generatedImage.findFirst.mockResolvedValue({ id: "gen_1" });
    const res = await deleteImage(
      new Request("http://localhost/api/products/proj_1/images", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId: "gen_1" }),
      }),
      { params: Promise.resolve({ id: "proj_1" }) }
    );

    expect(res.status).toBe(200);
    expect(dbMock.generatedImage.update).toHaveBeenCalledWith({
      where: { id: "gen_1" },
      data: { status: "DELETED" },
    });
    expect(dbMock.generatedImage.updateMany).not.toHaveBeenCalled();
    expect(dbMock.productImage.delete).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(tx.generatedImage.updateMany).not.toHaveBeenCalled();
  });
});
