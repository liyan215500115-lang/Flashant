import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const { openaiCreate, fluxCreate, uploadBuffer, fetchImageBuffer, storage } = vi.hoisted(() => ({
  openaiCreate: vi.fn(),
  fluxCreate: vi.fn(),
  uploadBuffer: vi.fn(),
  fetchImageBuffer: vi.fn(),
  storage: { enabled: false },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user_1" } })) }));
vi.mock("@/lib/db", () => ({
  db: {
    imageProject: {
      findUnique: vi.fn(async () => ({ id: "proj_1", userId: "user_1" })),
      update: vi.fn(async () => ({})),
    },
    task: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "task_1" })),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    productImage: {
      findUnique: vi.fn(async () => ({ id: "img_1", s3Key: null, originalUrl: "https://cdn.example/product.jpg" })),
    },
    generatedImage: {
      create: vi.fn(),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    brandPreset: { findUnique: vi.fn() },
    promptTemplate: { findUnique: vi.fn(async () => null) },
  },
}));
vi.mock("@/lib/creem/credits-runtime", () => ({
  chargeScreenedGeneration: vi.fn(async () => ({
    ok: true,
    tier: "PRO",
    balance: 79,
    allotmentConfigured: true,
    hold: { accountId: "cca_unit", transactionId: "cct_unit", amount: 1, moderationId: "mod_unit", reference: "gen:unit", idempotencyKey: "debit:unit" },
  })),
  refundGenerationDebit: vi.fn(async () => ({ reversed: true })),
  localPlanTier: vi.fn(async () => "FREE"),
}));
vi.mock("@/lib/ai/registry", () => ({
  getProvider: (name?: string) => name === "openai"
    ? { createPrediction: openaiCreate, getPrediction: vi.fn() }
    : { createPrediction: fluxCreate, getPrediction: vi.fn() },
}));
vi.mock("@/lib/s3", () => ({
  getSignedGetUrl: vi.fn(async () => "https://cdn.example/signed.jpg"),
  uploadBuffer,
  hasS3Config: () => storage.enabled,
}));
vi.mock("@/lib/reference-image", () => ({ prepareReferenceImage: vi.fn(async (url: string) => url) }));
vi.mock("@/lib/overlay-logo", () => ({ overlayLogo: vi.fn(), fetchImageBuffer }));
vi.mock("@/lib/server-t", () => ({ serverT: vi.fn(async (key: string) => key) }));

import { generateDetailPack } from "@/app/api/generate/route";
import { db } from "@/lib/db";

const PROVIDER_URL = "https://provider.example/unlettered.png";
const ORIGINAL_URL = "https://cdn.example/original.png";
const POSTER_URL = "https://cdn.example/poster.png";
const TITLE = "磨砂圆柱瓶身 AMBER";

async function productPng(): Promise<Buffer> {
  const swatch = await sharp({
    create: { width: 80, height: 50, channels: 3, background: { r: 180, g: 40, b: 40 } },
  }).png().toBuffer();
  return sharp({
    create: { width: 240, height: 320, channels: 3, background: { r: 250, g: 248, b: 244 } },
  }).composite([{ input: swatch, top: 120, left: 80 }]).png().toBuffer();
}

function allowModeration() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    decision: "allow",
    id: "mod_unit",
    object: "moderation_result",
  }), { status: 200, headers: { "content-type": "application/json" } })));
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.enabled = true;
  vi.stubEnv("CREEM_MODERATION", "enforce");
  vi.stubEnv("CREEM_API_KEY", "creem_test_unit");
  allowModeration();
  let created = 0;
  vi.mocked(db.generatedImage.create).mockImplementation(async () => ({ id: `gen_${++created}` }));
  openaiCreate.mockResolvedValue({ predictionId: "oa_1", status: "succeeded", outputs: [{ url: PROVIDER_URL }] });
  fluxCreate.mockResolvedValue({ predictionId: "flux_1", status: "succeeded", outputs: [{ url: PROVIDER_URL }] });
  uploadBuffer.mockReset();
  uploadBuffer
    .mockResolvedValueOnce({ s3Key: "generated/original.png", publicUrl: ORIGINAL_URL })
    .mockResolvedValueOnce({ s3Key: "generated/poster.png", publicUrl: POSTER_URL });
  fetchImageBuffer.mockImplementation(async () => productPng());
});

function posterInput(shotKey: string, copy?: Record<string, unknown>) {
  return {
    userId: "user_1",
    imageProjectId: "proj_1",
    productImageId: "img_1",
    detailTypes: [{ key: shotKey, prompt: "核心卖点", specText: "不要写进海报" }],
    poster: {
      enabled: true,
      template: "B",
      market: "zh",
      copy: copy ?? { series: "AMBER", title: TITLE, dek: "开盖可用", tags: [{ en: "GLASS", cn: "玻璃" }] },
    },
  };
}

describe("poster versions stay beside the unlettered pack", () => {
  it("does nothing when the template is off", async () => {
    const res = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      detailTypes: [{ key: "lifestyle", prompt: "bathroom morning light" }],
    });
    const json = await res.json();
    expect(json.generated).toHaveLength(1);
    expect(json.posters).toBeUndefined();
    expect(openaiCreate).not.toHaveBeenCalled();
    expect(fluxCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps the unlettered original and stores a separate poster without a second model run", async () => {
    const source = await productPng();
    const before = await sharp(source).metadata();
    const res = await generateDetailPack(posterInput("selling_points"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(openaiCreate).toHaveBeenCalledTimes(1);
    expect(fluxCreate).not.toHaveBeenCalled();
    const prompt = String(openaiCreate.mock.calls[0][0].prompt);
    expect(prompt).not.toContain(TITLE);
    expect(prompt).not.toContain("AMBER");
    expect(prompt).not.toContain("开盖可用");
    expect(prompt).not.toContain("玻璃");
    expect(prompt).not.toContain("不要写进海报");

    expect(json.generated).toHaveLength(1);
    expect(json.generated[0].url).toBe(ORIGINAL_URL);
    expect(json.generated[0].unlettered).toBe(true);
    expect(json.posters).toHaveLength(1);
    expect(json.posters[0].url).toBe(POSTER_URL);
    expect(json.posters[0].sourceId).toBe("gen_1");
    expect(json.posters[0].url).not.toBe(json.generated[0].url);
    expect(json.posterFailed ?? []).toEqual([]);

    const originalUpload = uploadBuffer.mock.calls[0][0] as Buffer;
    const posterUpload = uploadBuffer.mock.calls[1][0] as Buffer;
    const originalMeta = await sharp(originalUpload).metadata();
    const posterMeta = await sharp(posterUpload).metadata();
    expect(originalMeta.height).toBe(before.height);
    expect(posterMeta.height).toBeGreaterThan(before.height ?? 0);
    expect(originalUpload.equals(posterUpload)).toBe(false);

    const updates = vi.mocked(db.generatedImage.update).mock.calls.map((call) => call[0]);
    const originalUrls = updates.filter((call) => call.where.id === "gen_1").map((call) => call.data.url);
    expect(originalUrls).toContain(ORIGINAL_URL);
    expect(originalUrls).not.toContain(POSTER_URL);
    const bodies = vi.mocked(fetch).mock.calls.map((call) => JSON.stringify(call[1] ?? ""));
    expect(bodies.some((body) => body.includes(TITLE))).toBe(true);
  });

  it("does not report a failed overlay as a successful poster", async () => {
    const res = await generateDetailPack(posterInput("material", { title: "瓶\uE000" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.generated).toHaveLength(1);
    expect(json.generated[0].url).toBe(ORIGINAL_URL);
    expect(json.posters).toEqual([]);
    expect(json.posterFailed[0].reason).toBe("caption_glyphs_missing");
    expect(JSON.stringify(json.posters)).not.toContain(ORIGINAL_URL);
    expect(uploadBuffer).toHaveBeenCalledTimes(1);
    const created = vi.mocked(db.generatedImage.create).mock.calls.map((call) => call[0].data);
    expect(created.some((row) => row.status === "SUCCEEDED" && row.generationMeta?.posterRole === "original")).toBe(true);
    expect(created.some((row) => row.status === "FAILED" && row.errorMessage === "caption_glyphs_missing")).toBe(true);
    expect(created.some((row) => row.status === "SUCCEEDED" && row.generationMeta?.posterRole === "poster")).toBe(false);
  });

  it("does not overlay lifestyle shots or empty poster fields", async () => {
    const lifestyle = await generateDetailPack(posterInput("lifestyle"));
    const lifestyleJson = await lifestyle.json();
    expect(lifestyleJson.posters).toEqual([]);
    expect(lifestyleJson.posterFailed).toEqual([]);
    expect(String(fluxCreate.mock.calls.at(-1)?.[0].prompt)).not.toContain(TITLE);

    uploadBuffer.mockReset();
    uploadBuffer.mockResolvedValue({ s3Key: "generated/original.png", publicUrl: ORIGINAL_URL });
    const empty = await generateDetailPack({
      ...posterInput("selling_points", { title: "  ", series: "" }),
      detailTypes: [{ key: "selling_points", prompt: "", specText: "" }],
    });
    const emptyJson = await empty.json();
    expect(emptyJson.generated).toHaveLength(1);
    expect(emptyJson.posters).toEqual([]);
    expect(String(openaiCreate.mock.calls.at(-1)?.[0].prompt)).not.toContain(TITLE);
  });
});
