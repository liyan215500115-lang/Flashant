import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { BLANKET_TEXT_BAN, PRESERVE_PRODUCT_LETTERING, shotPreservesProductLettering } from "@/lib/generate/product-lettering";
import { packFailureReasonLabel } from "@/lib/generate/pack-summary";

const { getProviderMock, openaiCreate, fluxCreate, uploadBuffer, fetchImageBuffer, storage } = vi.hoisted(() => {
  const openaiCreate = vi.fn();
  const fluxCreate = vi.fn();
  return {
    openaiCreate,
    fluxCreate,
    uploadBuffer: vi.fn(),
    fetchImageBuffer: vi.fn(),
    storage: { enabled: false },
    getProviderMock: vi.fn((name?: string) => {
      if (name === "openai") return { createPrediction: openaiCreate, getPrediction: vi.fn() };
      return { createPrediction: fluxCreate, getPrediction: vi.fn() };
    }),
  };
});

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
      findUnique: vi.fn(async () => ({
        id: "img_1",
        s3Key: null,
        originalUrl: "https://cdn.example/product.jpg",
      })),
    },
    generatedImage: {
      create: vi.fn(async () => ({ id: "gen_caption" })),
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
    hold: {
      accountId: "cca_unit",
      transactionId: "cct_unit",
      amount: 1,
      moderationId: "mod_unit",
      reference: "gen:unit",
      idempotencyKey: "debit:unit",
    },
  })),
  refundGenerationDebit: vi.fn(async () => ({ reversed: true })),
  localPlanTier: vi.fn(async () => "FREE"),
}));
vi.mock("@/lib/ai/registry", () => ({ getProvider: getProviderMock }));
vi.mock("@/lib/s3", () => ({
  getSignedGetUrl: vi.fn(async () => "https://cdn.example/signed.jpg"),
  uploadBuffer,
  hasS3Config: () => storage.enabled,
}));
vi.mock("@/lib/reference-image", () => ({
  prepareReferenceImage: vi.fn(async (url: string) => url),
}));
vi.mock("@/lib/overlay-logo", () => ({
  overlayLogo: vi.fn(),
  fetchImageBuffer,
}));
vi.mock("@/lib/server-t", () => ({ serverT: vi.fn(async (key: string) => key) }));

import { generateDetailPack } from "@/app/api/generate/route";
import { db } from "@/lib/db";
import { refundGenerationDebit } from "@/lib/creem/credits-runtime";

const PROVIDER_URL = "https://provider.example/vega-or-flux.png";
const STORED_URL = "https://cdn.example/stored/unit.png";
const SPEC = "温和保湿";

async function productPng(): Promise<Buffer> {
  const swatch = await sharp({
    create: { width: 80, height: 50, channels: 3, background: { r: 220, g: 30, b: 40 } },
  }).png().toBuffer();
  return sharp({
    create: { width: 220, height: 220, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).composite([{ input: swatch, top: 24, left: 70 }]).png().toBuffer();
}

function allowModeration() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    decision: "allow",
    id: "mod_unit",
    object: "moderation_result",
  }), { status: 200, headers: { "content-type": "application/json" } })));
}

function sellingShot(extra?: { prompt?: string; specText?: string; baseStyle?: string }) {
  return {
    userId: "user_1",
    imageProjectId: "proj_1",
    productImageId: "img_1",
    baseStyle: extra?.baseStyle ?? "soft studio light",
    detailTypes: [{
      key: "selling_points",
      prompt: extra?.prompt ?? "核心卖点 — 请写成大字",
      specText: extra && "specText" in extra ? extra.specText : SPEC,
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.enabled = false;
  vi.stubEnv("CREEM_MODERATION", "enforce");
  vi.stubEnv("CREEM_API_KEY", "creem_test_unit");
  allowModeration();
  openaiCreate.mockResolvedValue({
    predictionId: "oa_1",
    status: "succeeded",
    outputs: [{ url: PROVIDER_URL }],
  });
  fluxCreate.mockResolvedValue({
    predictionId: "flux_1",
    status: "succeeded",
    outputs: [{ url: PROVIDER_URL }],
  });
  uploadBuffer.mockResolvedValue({ s3Key: "generated/unit.png", publicUrl: STORED_URL });
  fetchImageBuffer.mockImplementation(async () => productPng());
});

describe("product-showing pack shots", () => {
  it("keeps original lettering and leaves spec text out of the model prompt", async () => {
    for (const key of ["lifestyle", "multi_angle", "detail", "in_use", "scene_atmosphere"] as const) {
      expect(shotPreservesProductLettering(key)).toBe(true);
    }
    expect(shotPreservesProductLettering("selling_points")).toBe(false);

    const res = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      detailTypes: ["lifestyle", "multi_angle", "detail", "in_use"].map((key) => ({
        key,
        prompt: `浴室晨光 ${SPEC}`,
        specText: SPEC,
      })),
    });
    expect(res.status).toBe(200);
    const prompts = fluxCreate.mock.calls.map((call) => String(call[0].prompt));
    expect(prompts).toHaveLength(4);
    for (const prompt of prompts) {
      expect(prompt).not.toContain(BLANKET_TEXT_BAN);
      expect(prompt).toContain(PRESERVE_PRODUCT_LETTERING);
      expect(prompt).not.toContain(SPEC);
      expect(prompt).toContain("浴室晨光");
      expect(prompt.toLowerCase()).not.toContain("selling point");
    }
    expect(prompts.some((prompt) => prompt.includes("Macro photograph"))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes("true side near 90 degrees"))).toBe(true);
  });
});

describe("info-shot spec captions", () => {
  it("does not send spec text to the model and does not forbid original product lettering", async () => {
    storage.enabled = true;
    const res = await generateDetailPack(sellingShot());
    expect(res.status).toBe(200);
    const prompt = String(openaiCreate.mock.calls[0][0].prompt);
    expect(prompt).not.toContain(SPEC);
    expect(prompt).not.toContain("请写成大字");
    expect(prompt).not.toContain("soft studio light");
    expect(prompt).not.toContain(BLANKET_TEXT_BAN);
    expect(prompt).toContain(PRESERVE_PRODUCT_LETTERING);
    expect(prompt).not.toContain("85%");
    expect(prompt).toContain("caption band");
    expect(fluxCreate).not.toHaveBeenCalled();

    const storedPrompt = String(vi.mocked(db.generatedImage.create).mock.calls[0][0].data.promptUsed);
    expect(storedPrompt).not.toContain(SPEC);
    expect(storedPrompt).toContain("existing brand name");

    const bodies = vi.mocked(fetch).mock.calls.map((call) => JSON.stringify(call[1] ?? ""));
    expect(bodies.some((body) => body.includes(SPEC))).toBe(true);
  });

  it("keeps original lettering allowed when the user entered no spec text", async () => {
    const res = await generateDetailPack(sellingShot({ prompt: "核心卖点", specText: "" }));
    expect(res.status).toBe(200);
    const prompt = String(openaiCreate.mock.calls[0][0].prompt);
    expect(prompt).not.toContain(BLANKET_TEXT_BAN);
    expect(prompt).toContain("existing brand name");
    expect(prompt).not.toContain("核心卖点");
    expect(fetchImageBuffer).not.toHaveBeenCalled();
  });

  it("persists the server-side caption on our storage URL", async () => {
    storage.enabled = true;
    const res = await generateDetailPack(sellingShot());
    const json = await res.json();
    expect(json.generated[0].url).toBe(STORED_URL);
    expect(json.generated[0].url).not.toBe(PROVIDER_URL);
    expect(uploadBuffer).toHaveBeenCalled();
    const uploaded = uploadBuffer.mock.calls[0][0] as Buffer;
    const { data, info } = await sharp(uploaded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const product = data[(40 * info.width + 100) * info.channels];
    expect(product).toBeGreaterThan(180);
    let darkBelow = 0;
    for (let y = 90; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 2) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) darkBelow += 1;
      }
    }
    expect(darkBelow).toBeGreaterThan(10);
    const updates = vi.mocked(db.generatedImage.update).mock.calls.map((call) => call[0].data);
    expect(updates.some((row) => row.url === STORED_URL && row.s3Key === "generated/unit.png")).toBe(true);
    expect(updates.some((row) => row.status === "SUCCEEDED" && row.url === STORED_URL)).toBe(true);
  });

  it("retries a failed transfer and then stores our URL", async () => {
    storage.enabled = true;
    uploadBuffer
      .mockRejectedValueOnce(new Error("COS timeout"))
      .mockRejectedValueOnce(new Error("COS timeout"))
      .mockResolvedValueOnce({ s3Key: "generated/unit.png", publicUrl: STORED_URL });
    const res = await generateDetailPack(sellingShot());
    const json = await res.json();
    expect(uploadBuffer).toHaveBeenCalledTimes(3);
    expect(json.generated[0].url).toBe(STORED_URL);
    expect(json.failed ?? []).toEqual([]);
  });

  it("does not treat an overlay failure as a successful uncaptioned image", async () => {
    storage.enabled = true;
    fetchImageBuffer.mockRejectedValue(new Error("COS timeout"));
    const res = await generateDetailPack(sellingShot());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.generated).toEqual([]);
    expect(json.failed[0].reason).toBe("caption_overlay_failed");
    expect(json.failed[0].creditsRefunded).toBe(true);
    expect(uploadBuffer).not.toHaveBeenCalled();
    expect(JSON.stringify(json.generated)).not.toContain(PROVIDER_URL);
    const created = vi.mocked(db.generatedImage.create).mock.calls.map((call) => call[0].data);
    expect(created.some((row) => row.status === "SUCCEEDED")).toBe(false);
    expect(created.some((row) => row.status === "FAILED" && row.errorMessage === "caption_overlay_failed")).toBe(true);
    expect(packFailureReasonLabel("caption_overlay_failed", "zh")).toContain("规格文字");
    expect(refundGenerationDebit).toHaveBeenCalled();
  });

  it("does not keep a success when the caption cannot be stored", async () => {
    storage.enabled = true;
    uploadBuffer.mockRejectedValue(new Error("storage down"));
    const res = await generateDetailPack(sellingShot());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.generated).toEqual([]);
    expect(json.failed[0].reason).toBe("caption_not_persisted");
    expect(json.creditsCharged).toBe(0);
    expect(JSON.stringify(json)).not.toContain(STORED_URL);
    const statuses = vi.mocked(db.generatedImage.update).mock.calls
      .map((call) => call[0].data.status)
      .filter(Boolean);
    expect(statuses.at(-1)).toBe("FAILED");
    expect(packFailureReasonLabel("caption_not_persisted", "zh")).not.toBe("caption_not_persisted");
  });

  it("keeps the provider URL only after persistence retries fail on a shot with no spec text", async () => {
    storage.enabled = true;
    uploadBuffer.mockRejectedValue(new Error("COS timeout"));
    const res = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      detailTypes: [{ key: "lifestyle", prompt: "bathroom morning light" }],
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(uploadBuffer).toHaveBeenCalledTimes(3);
    expect(json.generated[0].url).toBe(PROVIDER_URL);
    expect(json.completed).toBe(1);
    const created = vi.mocked(db.generatedImage.create).mock.calls.map((call) => call[0].data);
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("SUCCEEDED");
    expect(created[0].url).toBe(PROVIDER_URL);
  });
});
