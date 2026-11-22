import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProviderMock, createPrediction, getPrediction } = vi.hoisted(() => {
  const createPrediction = vi.fn();
  const getPrediction = vi.fn();
  return {
    createPrediction,
    getPrediction,
    getProviderMock: vi.fn((name?: string) => {
      if (name === "vega") throw new Error("vega not registered");
      return { createPrediction, getPrediction };
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
      create: vi.fn(async () => ({ id: "gen_1" })),
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
    balance: 90,
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
  uploadBuffer: vi.fn(),
  hasS3Config: () => false,
}));
vi.mock("@/lib/reference-image", () => ({
  prepareReferenceImage: vi.fn(async (url: string) => url),
}));
vi.mock("@/lib/overlay-logo", () => ({
  overlayLogo: vi.fn(),
  fetchImageBuffer: vi.fn(),
}));
vi.mock("@/lib/server-t", () => ({ serverT: vi.fn(async (key: string) => key) }));

import { generateDetailPack, POST as generatePost } from "@/app/api/generate/route";
import { PACK_BUDGET_MS } from "@/lib/generate/pack-timing";
import { db } from "@/lib/db";
import { refundGenerationDebit } from "@/lib/creem/credits-runtime";

const PRODUCT = "https://cdn.example/product.jpg";
const STYLE = "https://cdn.example/style-lock.jpg";
const RECOMMENDED = ["lifestyle", "in_use", "detail", "multi_angle", "flatlay", "color_variants"] as const;

function allowModeration() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    decision: "allow",
    id: "mod_unit",
    object: "moderation_result",
  }), { status: 200, headers: { "content-type": "application/json" } })));
}

function stubVegaEnv() {
  vi.stubEnv("TENCENT_MAAS_API_KEY", "unit-test-placeholder");
  vi.stubEnv("TENCENT_MAAS_BASE_URL", "https://maas.example.test");
  vi.stubEnv("TENCENT_MAAS_IMAGE_MODEL", "wand-vega-image-1.5-pro");
  vi.stubEnv("TENCENT_MAAS_LITE_IMAGE_MODEL", "wand-vega-image-lite");
}

function clearVegaEnv() {
  for (const key of [
    "TENCENT_MAAS_API_KEY",
    "TENCENT_MAAS_BASE_URL",
    "TENCENT_MAAS_IMAGE_MODEL",
    "TENCENT_MAAS_LITE_IMAGE_MODEL",
  ]) vi.stubEnv(key, "");
}

function post(body: unknown) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function recommendedPack() {
  return {
    imageProjectId: "proj_1",
    productImageId: "img_1",
    category: "fashion",
    baseStyle: "gold earrings",
    referenceImageUrl: STYLE,
    detailTypes: RECOMMENDED.map((key) => ({ key, prompt: `${key} shot` })),
  };
}

function providersRequested(): string[] {
  return getProviderMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  vi.clearAllMocks();
  clearVegaEnv();
  vi.stubEnv("CREEM_MODERATION", "enforce");
  vi.stubEnv("CREEM_API_KEY", "creem_test_unit");
  allowModeration();
  getProviderMock.mockImplementation((name?: string) => {
    if (name === "vega") throw new Error("vega not registered");
    return { createPrediction, getPrediction };
  });
  createPrediction.mockResolvedValue({
    predictionId: "pred_1",
    status: "succeeded",
    outputs: [{ url: "https://cdn.example/out.png" }],
  });
  getPrediction.mockResolvedValue({ status: "processing", outputs: [] });
});

describe("recommended pack Vega routing", () => {
  it("sends recommended pack shots to Vega when the Vega env names are set", async () => {
    stubVegaEnv();
    getProviderMock.mockImplementation(() => ({ createPrediction, getPrediction }));

    const res = await generatePost(post(recommendedPack()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.completed).toBe(RECOMMENDED.length);

    expect(providersRequested()).toContain("vega");
    expect(providersRequested()).not.toContain("vega-lite");
    const shotProviders = providersRequested().filter((name) => name !== "flux");
    expect(shotProviders.length).toBeGreaterThan(0);
    expect(shotProviders.every((name) => name === "vega")).toBe(true);

    const rows = vi.mocked(db.generatedImage.create).mock.calls.map((call) => call[0].data);
    expect(rows).toHaveLength(RECOMMENDED.length);
    expect(rows.every((row: { aiProvider: string; modelVersion?: string }) => row.aiProvider === "vega")).toBe(true);
    expect(rows.every((row: { modelVersion?: string }) => row.modelVersion === "wand-vega-image-1.5-pro")).toBe(true);
    expect(rows.some((row: { modelVersion?: string }) => String(row.modelVersion).includes("unit-test-placeholder"))).toBe(false);
    expect(rows.some((row: { modelVersion?: string }) => row.modelVersion === "black-forest-labs/flux-2-pro")).toBe(false);

    const inputs = createPrediction.mock.calls.map((call) => call[0] as {
      productImageUrl: string;
      referenceImageUrl?: string;
      prompt: string;
    });
    expect(inputs).toHaveLength(RECOMMENDED.length);
    for (const input of inputs) {
      expect(input.productImageUrl).toBe(PRODUCT);
    }
    const detail = inputs.find((input) => input.prompt.includes("detail shot"));
    expect(detail?.referenceImageUrl).toBeUndefined();
    for (const key of ["lifestyle", "in_use", "multi_angle", "flatlay", "color_variants"]) {
      const shot = inputs.find((input) => input.prompt.includes(`${key} shot`));
      expect(shot?.referenceImageUrl, key).toBe(STYLE);
    }
  });

  it("falls back to flux when the Vega env vars are missing or the endpoint is incomplete", async () => {
    const missing = await generatePost(post({
      ...recommendedPack(),
      detailTypes: [{ key: "lifestyle", prompt: "lifestyle shot" }],
    }));
    expect(missing.status).toBe(200);
    expect(providersRequested()).not.toContain("vega");
    expect(vi.mocked(db.generatedImage.create).mock.calls[0][0].data.aiProvider).toBe("flux");

    vi.clearAllMocks();
    allowModeration();
    stubVegaEnv();
    vi.stubEnv("TENCENT_MAAS_BASE_URL", "tokenhub.example.test");
    const incomplete = await generatePost(post({
      ...recommendedPack(),
      detailTypes: [{ key: "flatlay", prompt: "flatlay shot" }],
    }));
    expect(incomplete.status).toBe(200);
    expect(providersRequested()).not.toContain("vega");
    expect(vi.mocked(db.generatedImage.create).mock.calls[0][0].data.aiProvider).toBe("flux");
  });

  it("falls back to flux when Vega is configured but not registered", async () => {
    stubVegaEnv();
    const res = await generatePost(post({
      ...recommendedPack(),
      detailTypes: [{ key: "in_use", prompt: "in_use shot" }],
    }));
    expect(res.status).toBe(200);
    expect(providersRequested()).toContain("vega");
    expect(vi.mocked(db.generatedImage.create).mock.calls[0][0].data.aiProvider).toBe("flux");
    expect(createPrediction).toHaveBeenCalled();
  });

  it("keeps selling_points on the OpenAI path when Vega is configured", async () => {
    stubVegaEnv();
    const openaiCreate = vi.fn(async () => ({
      predictionId: "oa_1",
      status: "succeeded",
      outputs: [{ url: "https://cdn.example/text.png" }],
    }));
    const fluxCreate = vi.fn();
    getProviderMock.mockImplementation((name?: string) => {
      if (name === "openai") return { createPrediction: openaiCreate, getPrediction };
      if (name === "flux") return { createPrediction: fluxCreate, getPrediction };
      if (name === "vega") return { createPrediction, getPrediction };
      throw new Error(`unexpected ${name}`);
    });

    const res = await generatePost(post({
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "electronics",
      detailTypes: [
        { key: "selling_points", prompt: "three feature callouts" },
        { key: "compare", prompt: "side by side" },
        { key: "size", prompt: "dimension chart" },
      ],
    }));
    expect(res.status).toBe(200);
    expect(openaiCreate).toHaveBeenCalledTimes(3);
    expect(fluxCreate).not.toHaveBeenCalled();
    expect(createPrediction).not.toHaveBeenCalled();
    const rows = vi.mocked(db.generatedImage.create).mock.calls.map((call) => call[0].data);
    expect(rows.map((row: { aiProvider: string }) => row.aiProvider)).toEqual(["openai", "openai", "openai"]);
    expect(rows.every((row: { modelVersion?: string }) => row.modelVersion === "gpt-image-2")).toBe(true);
    expect(rows.some((row: { modelVersion?: string }) => row.modelVersion === "wand-vega-image-1.5-pro")).toBe(false);
  });

  it("does not move a single-image request onto Vega", async () => {
    stubVegaEnv();
    getProviderMock.mockImplementation((name?: string) => {
      if (name === "vega") throw new Error("single image must not ask for vega");
      return { createPrediction, getPrediction };
    });
    const res = await generatePost(post({
      imageProjectId: "proj_1",
      productImageId: "img_1",
      prompt: "a red ceramic mug on an oak desk",
      numOutputs: 1,
      engineType: "flux",
    }));
    expect(res.status).toBe(200);
    expect(providersRequested()).toContain("flux");
    expect(providersRequested()).not.toContain("vega");
  });

  it("polls an in-flight Vega shot and refunds only that shot when it fails", async () => {
    stubVegaEnv();
    const vegaGet = vi.fn(async () => ({ status: "failed", outputs: [], error: "vega_failed" }));
    const fluxGet = vi.fn();
    getProviderMock.mockImplementation((name?: string) => ({
      createPrediction,
      getPrediction: name === "vega" ? vegaGet : fluxGet,
    }));
    createPrediction.mockResolvedValue({ predictionId: "task_vega", status: "processing", outputs: [] });

    const res = await generatePost(post({
      ...recommendedPack(),
      detailTypes: [{ key: "lifestyle", prompt: "lifestyle shot" }],
    }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(vegaGet).toHaveBeenCalledWith("task_vega");
    expect(fluxGet).not.toHaveBeenCalled();
    expect(json.failed[0].reason).toBe("vega_failed");
    expect(json.failed[0].creditsRefunded).toBe(true);
    expect(json.creditsCharged).toBe(0);
    expect(refundGenerationDebit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.generatedImage.create).mock.calls[0][0].data).toMatchObject({
      aiProvider: "vega",
      modelVersion: "wand-vega-image-1.5-pro",
      status: "FAILED",
      errorMessage: "vega_failed",
    });
  });

  it("submits all six Vega shots before polling, and finishes them inside one pack budget", async () => {
    stubVegaEnv();
    const events: string[] = [];
    const shotMs = 90_000;
    let clock = 1_000_000;
    const seen = new Set<string>();
    createPrediction.mockImplementation(async () => {
      const id = `task_${createPrediction.mock.calls.length}`;
      events.push(`create:${id}`);
      return { predictionId: id, status: "processing", outputs: [] };
    });
    getPrediction.mockImplementation(async (id: string) => {
      events.push(`poll:${id}`);
      if (!seen.has(id)) {
        if (seen.size === 0) clock += shotMs;
        seen.add(id);
        return { status: "processing", outputs: [] };
      }
      return { status: "succeeded", outputs: [{ url: `https://cdn.example/${id}.png` }] };
    });
    getProviderMock.mockImplementation((name?: string) => {
      if (name === "vega") {
        return { createPrediction, getPrediction, model: "wand-vega-image-1.5-pro" };
      }
      return { createPrediction, getPrediction };
    });

    const res = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      baseStyle: "gold earrings",
      referenceImageUrl: STYLE,
      detailTypes: RECOMMENDED.map((key) => ({ key, prompt: `${key} shot` })),
      now: () => clock,
      sleep: async () => {},
    });
    const json = await res.json();
    const firstPoll = events.findIndex((event) => event.startsWith("poll:"));
    expect(firstPoll).toBe(RECOMMENDED.length);
    expect(events.slice(0, firstPoll).every((event) => event.startsWith("create:"))).toBe(true);
    expect(json.completed).toBe(RECOMMENDED.length);
    expect(json.completed).toBeGreaterThan(3);
    for (const call of createPrediction.mock.calls) {
      expect((call[0] as { productImageUrl: string }).productImageUrl).toBe(PRODUCT);
    }
    expect(clock - 1_000_000).toBe(shotMs);
    expect(clock).toBeLessThan(1_000_000 + PACK_BUDGET_MS);
    expect(shotMs * 6).toBeGreaterThan(PACK_BUDGET_MS);
    const rows = vi.mocked(db.generatedImage.create).mock.calls.map((call) => call[0].data);
    expect(rows).toHaveLength(RECOMMENDED.length);
    expect(rows.every((row: { aiProvider: string; modelVersion: string }) =>
      row.aiProvider === "vega" && row.modelVersion === "wand-vega-image-1.5-pro"
    )).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("unit-test-placeholder");
  });
});
