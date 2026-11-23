import { beforeEach, describe, expect, it, vi } from "vitest";
import { STYLE_PROMPTS } from "@/lib/ai/style-prompts";

const { authMock, dbMock, chargeMock, refundMock, getProviderMock, createPrediction, getPrediction, signedUrl } = vi.hoisted(() => {
  const createPrediction = vi.fn();
  const getPrediction = vi.fn();
  return {
    createPrediction,
    getPrediction,
    authMock: vi.fn(),
    chargeMock: vi.fn(),
    refundMock: vi.fn(),
    getProviderMock: vi.fn(() => ({ createPrediction, getPrediction })),
    signedUrl: vi.fn(async () => "https://cdn.example/signed.jpg"),
    dbMock: {
      imageProject: { findUnique: vi.fn(), update: vi.fn() },
      task: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(async () => 0) },
      productImage: { findUnique: vi.fn() },
      generatedImage: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn(async () => 0) },
      brandPreset: { findUnique: vi.fn() },
      promptTemplate: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/creem/credits-runtime", () => ({
  chargeScreenedGeneration: chargeMock,
  refundGenerationDebit: refundMock,
  localPlanTier: vi.fn(async () => "FREE"),
}));
vi.mock("@/lib/ai/registry", () => ({ getProvider: getProviderMock }));
vi.mock("@/lib/s3", () => ({
  getSignedGetUrl: signedUrl,
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

import { generateDetailPack, maxDuration, POST as generatePost } from "@/app/api/generate/route";
import { POST as batchPost } from "@/app/api/generate/batch/route";
import {
  HOBBY_MAX_DURATION_SECONDS,
  MIN_START_MS,
  NOT_STARTED_REASON,
  PACK_BUDGET_MS,
  PACK_CLOSE_MARGIN_MS,
  PER_SHOT_WAIT_MS,
} from "@/lib/generate/pack-timing";
import {
  ATMOSPHERE_DISTINCT_COMPOSITION,
  COMPARE_ONLY_REAL_ATTRIBUTES,
  JEWELRY_SILHOUETTE_LOCK,
  LIFESTYLE_DISTINCT_COMPOSITION,
  MULTI_ANGLE_DISTINCT_VIEWS,
  NO_ELECTRONICS_ON_NONELECTRONIC,
  NO_INVENTED_ACCESSORIES,
  NO_SOURCE_WATERMARK,
  NO_UNSEEN_STRUCTURE,
  PORTRAIT_REFERENCE_LOCK,
  SELLING_POINTS_UNCHANGED_PRODUCT,
  SINGLE_COLOR_MERCHANDISING,
  SOURCE_STRUCTURE_LOCK,
  STYLE_LOCK_SAME_PRODUCT,
} from "@/lib/generate/detail-shot";

const fetchMock = vi.fn();

function moderationResponse(decision: string, status = 200, id = "mod_1") {
  return new Response(JSON.stringify({ decision, id, object: "moderation_result" }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CREEM_MODERATION", "enforce");
  vi.stubEnv("CREEM_API_KEY", "creem_test_unit");
  vi.stubEnv("CREEM_TEST_MODE", "");
  fetchMock.mockRejectedValue(new Error("unexpected fetch"));
  authMock.mockResolvedValue({ user: { id: "user_1" } });
  chargeMock.mockResolvedValue({
    ok: true,
    tier: "PRO",
    balance: 99,
    allotmentConfigured: true,
    hold: {
      accountId: "cca_1",
      transactionId: "cct_1",
      amount: 1,
      moderationId: "mod_1",
      reference: "gen:1",
      idempotencyKey: "debit:1",
    },
  });
  refundMock.mockResolvedValue({ reversed: true });
  dbMock.imageProject.findUnique.mockResolvedValue({ id: "proj_1", userId: "user_1" });
  dbMock.imageProject.update.mockResolvedValue({});
  dbMock.task.findFirst.mockResolvedValue(null);
  dbMock.task.create.mockResolvedValue({ id: "task_1" });
  dbMock.task.update.mockResolvedValue({});
  dbMock.productImage.findUnique.mockResolvedValue({
    id: "img_1",
    s3Key: null,
    originalUrl: "https://cdn.example/product.jpg",
  });
  dbMock.generatedImage.create.mockResolvedValue({ id: "gen_1" });
  dbMock.generatedImage.update.mockResolvedValue({});
  dbMock.generatedImage.findMany.mockResolvedValue([
    { id: "gen_1", url: "https://cdn.example/out.png" },
  ]);
  dbMock.promptTemplate.findUnique.mockResolvedValue({
    prompt: "Kinfolk/Cereal magazine aesthetic static catalog template",
  });
  createPrediction.mockResolvedValue({
    predictionId: "pred_1",
    status: "succeeded",
    outputs: [{ url: "https://cdn.example/out.png", fileSize: 10, mimeType: "image/png", width: 1024, height: 1024 }],
  });
});

describe("POST /api/generate moderation gate", () => {
  const body = {
    imageProjectId: "proj_1",
    productImageId: "img_1",
    prompt: "a red ceramic mug on an oak desk",
    numOutputs: 1,
    engineType: "flux",
  };

  it("calls the model after an allow decision and screens only the user prompt", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    const res = await generatePost(post("http://localhost/api/generate", body));
    expect(res.status).toBe(200);
    expect(createPrediction).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    const screened = JSON.parse(init.body).prompt as string;
    expect(screened).toBe(body.prompt);
    expect(screened).not.toContain("Kinfolk");
    expect(createPrediction.mock.calls[0][0].prompt).toContain(body.prompt);
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(chargeMock.mock.calls[0][0].gate.moderationId).toBe("mod_1");
    expect(chargeMock.mock.calls[0][0].imageCount).toBe(1);
    expect(chargeMock.mock.calls[0][0].idempotencyKey).toMatch(/^debit:/);
  });

  it("does not call the model on deny or flag", async () => {
    for (const decision of ["deny", "flag"]) {
      vi.clearAllMocks();
      authMock.mockResolvedValue({ user: { id: "user_1" } });
      fetchMock.mockResolvedValue(moderationResponse(decision));
      const res = await generatePost(post("http://localhost/api/generate", body));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("prompt_rejected");
      expect(getProviderMock).not.toHaveBeenCalled();
      expect(createPrediction).not.toHaveBeenCalled();
      expect(chargeMock).not.toHaveBeenCalled();
    }
  });

  it("does not call the model when moderation times out or the key is missing", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted", "TimeoutError"));
    const timedOut = await generatePost(post("http://localhost/api/generate", body));
    expect(timedOut.status).toBe(503);
    expect(createPrediction).not.toHaveBeenCalled();

    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    vi.stubEnv("CREEM_API_KEY", "");
    const missing = await generatePost(post("http://localhost/api/generate", body));
    expect(missing.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createPrediction).not.toHaveBeenCalled();
  });

  it("screens a placeholder for an unmodified style template and still generates", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    const style = STYLE_PROMPTS.find((item) => item.key === "white")!.promptFlux;
    const res = await generatePost(post("http://localhost/api/generate", { ...body, prompt: style }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).prompt).toContain("no additional user text");
    expect(createPrediction).toHaveBeenCalled();
    expect(chargeMock).toHaveBeenCalledTimes(1);
  });

  it("screens a catalog template selected by id", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    const res = await generatePost(
      post("http://localhost/api/generate", {
        imageProjectId: "proj_1",
        productImageId: "img_1",
        promptTemplateId: "tpl_1",
        numOutputs: 1,
      }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(createPrediction).toHaveBeenCalled();
    expect(createPrediction.mock.calls[0][0].prompt).toContain("Kinfolk/Cereal");
  });

  it("debits a multi-image request in one charge and reverses when generation throws", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    const res = await generatePost(post("http://localhost/api/generate", { ...body, numOutputs: 4 }));
    expect(res.status).toBe(200);
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(chargeMock.mock.calls[0][0].imageCount).toBe(4);
    expect(createPrediction).toHaveBeenCalledTimes(4);

    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    chargeMock.mockResolvedValue({
      ok: true,
      tier: "PRO",
      balance: 96,
      allotmentConfigured: true,
      hold: {
        accountId: "cca_1",
        transactionId: "cct_fail",
        amount: 1,
        moderationId: "mod_1",
        reference: "gen:fail",
        idempotencyKey: "debit:fail",
      },
    });
    refundMock.mockResolvedValue({ reversed: true });
    dbMock.imageProject.findUnique.mockResolvedValue({ id: "proj_1", userId: "user_1" });
    dbMock.imageProject.update.mockResolvedValue({});
    dbMock.task.findFirst.mockResolvedValue(null);
    dbMock.task.create.mockResolvedValue({ id: "task_1" });
    dbMock.task.update.mockResolvedValue({});
    dbMock.productImage.findUnique.mockResolvedValue({
      id: "img_1",
      s3Key: null,
      originalUrl: "https://cdn.example/product.jpg",
    });
    createPrediction.mockRejectedValue(new Error("model down"));

    const failed = await generatePost(post("http://localhost/api/generate", body));
    expect(failed.status).toBe(500);
    const json = await failed.json();
    expect(json.creditsRefunded).toBe(true);
    expect(json.message).toContain("refunded");
    expect(refundMock).toHaveBeenCalledWith(expect.objectContaining({ transactionId: "cct_fail" }));
  });

  it("accepts a single-image run of 8 and rejects a run above the cap", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    const accepted = await generatePost(post("http://localhost/api/generate", { ...body, numOutputs: 8 }));
    expect(accepted.status).toBe(200);
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(chargeMock.mock.calls[0][0].imageCount).toBe(8);
    expect(createPrediction).toHaveBeenCalledTimes(8);

    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    const rejected = await generatePost(post("http://localhost/api/generate", { ...body, numOutputs: 9 }));
    expect(rejected.status).toBe(400);
    const json = await rejected.json();
    expect(json.error).toBe("quantity_cap");
    expect(json.max).toBe(8);
    expect(createPrediction).not.toHaveBeenCalled();
    expect(chargeMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not debit when the wallet balance is too low", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    chargeMock.mockResolvedValue({
      ok: false,
      error: "insufficient_credits",
      balance: 0,
      required: 1,
      tier: "FREE",
      allotmentConfigured: true,
    });
    const res = await generatePost(post("http://localhost/api/generate", body));
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe("insufficient_credits");
    expect(createPrediction).not.toHaveBeenCalled();
    expect(refundMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/generate/batch moderation gate", () => {
  const body = {
    imageProjectId: "proj_1",
    productImageIds: ["img_1"],
    prompt: "a linen tote in soft daylight",
    numOutputs: 1,
  };

  it("calls the model after allow", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    const res = await batchPost(post("http://localhost/api/generate/batch", body));
    expect(res.status).toBe(200);
    expect(createPrediction).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).prompt).toBe(body.prompt);
  });

  it("does not call the model on deny, flag, or timeout", async () => {
    for (const decision of ["deny", "flag"]) {
      vi.clearAllMocks();
      authMock.mockResolvedValue({ user: { id: "user_1" } });
      fetchMock.mockResolvedValue(moderationResponse(decision));
      const res = await batchPost(post("http://localhost/api/generate/batch", body));
      expect(res.status).toBe(400);
      expect(createPrediction).not.toHaveBeenCalled();
    }
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted", "TimeoutError"));
    const timedOut = await batchPost(post("http://localhost/api/generate/batch", body));
    expect(timedOut.status).toBe(503);
    expect(createPrediction).not.toHaveBeenCalled();
  });

  it("screens a placeholder when the prompt is empty and still generates", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow"));
    const res = await batchPost(
      post("http://localhost/api/generate/batch", { ...body, prompt: "" }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).prompt).toContain("no additional user text");
    expect(createPrediction.mock.calls[0][0].prompt).toBe("Professional product photography");
    expect(chargeMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/generate pack shots", () => {
  const fashionPack = {
    imageProjectId: "proj_1",
    productImageId: "img_1",
    category: "fashion",
    baseStyle: "金色耳环，手工金饰",
    referenceImageUrl: "https://cdn.example/latest-face.png",
    referenceHasPerson: true,
    detailTypes: [
      { key: "in_use", prompt: "gold earrings worn outdoors" },
      { key: "lifestyle", prompt: "gold earrings lifestyle" },
      { key: "scene_atmosphere", prompt: "gold earrings dramatic atmosphere" },
      { key: "detail", prompt: "gold hoop earring macro" },
      { key: "multi_angle", prompt: "gold earrings angles" },
      { key: "flatlay", prompt: "gold earrings flatlay" },
      { key: "color_variants", prompt: "gold earrings colors" },
    ],
  };

  function chargePerImage() {
    let n = 0;
    chargeMock.mockImplementation(async (input: { gate: { moderationId?: string }; idempotencyKey: string; reference: string; imageCount: number }) => {
      n += 1;
      return {
        ok: true,
        tier: "PRO",
        balance: 100 - n,
        allotmentConfigured: true,
        hold: {
          accountId: "cca_1",
          transactionId: `cct_${input.idempotencyKey}`,
          amount: input.imageCount,
          moderationId: input.gate.moderationId,
          reference: input.reference,
          idempotencyKey: input.idempotencyKey,
        },
      };
    });
  }

  it("persists a FAILED row and refunds only the shots that did not come out", async () => {
    let moderation = 0;
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, `mod_pack_${++moderation}`));
    chargePerImage();
    createPrediction.mockImplementation(async (input: { prompt: string }) => {
      if (input.prompt.includes("gold hoop")) {
        return {
          predictionId: "pred_detail",
          status: "succeeded",
          outputs: [{ url: "https://cdn.example/detail.png" }],
        };
      }
      throw new Error("provider exploded");
    });

    const res = await generatePost(post("http://localhost/api/generate", fashionPack));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.completed).toBe(1);
    expect(json.requested).toBe(7);
    expect(json.failed).toHaveLength(6);
    expect(json.creditsCharged).toBe(1);
    expect(json.creditsRefunded).toBe(6);

    expect(chargeMock).toHaveBeenCalledTimes(7);
    for (const call of chargeMock.mock.calls) {
      expect(call[0].imageCount).toBe(1);
    }
    const keys = chargeMock.mock.calls.map((call) => call[0].idempotencyKey as string);
    expect(new Set(keys).size).toBe(7);
    const moderationIds = chargeMock.mock.calls.map((call) => call[0].gate.moderationId as string);
    expect(new Set(moderationIds).size).toBe(7);

    const detailCharge = chargeMock.mock.calls.find((call) => String(call[0].idempotencyKey).endsWith(":detail"));
    const detailTransaction = `cct_${detailCharge?.[0].idempotencyKey}`;
    const refunded = refundMock.mock.calls.map((call) => call[0].transactionId as string);
    expect(refunded).toHaveLength(6);
    expect(refunded).not.toContain(detailTransaction);

    const rows = dbMock.generatedImage.create.mock.calls.map((call) => call[0].data);
    const failedRows = rows.filter((row: { status: string }) => row.status === "FAILED");
    const succeededRows = rows.filter((row: { status: string }) => row.status === "SUCCEEDED");
    expect(failedRows).toHaveLength(6);
    expect(succeededRows).toHaveLength(1);
    expect(failedRows.every((row: { errorMessage: string }) => row.errorMessage === "provider exploded")).toBe(true);
    expect(dbMock.task.create.mock.calls.filter((call) => call[0].data.status === "FAILED")).toHaveLength(6);

    const detailCall = createPrediction.mock.calls
      .map((call) => call[0] as { prompt: string; productImageUrl: string; referenceImageUrl?: string })
      .find((input) => input.prompt.includes("gold hoop"));
    expect(detailCall?.productImageUrl).toBe("https://cdn.example/product.jpg");
    expect(detailCall?.prompt).not.toContain("visible in use (on skin");
    expect(detailCall?.prompt).not.toContain("Do NOT show any product packaging");
    expect(detailCall?.prompt).toContain("clearly recognizable");
    expect(detailCall?.referenceImageUrl).toBeUndefined();
    expect(succeededRows[0].promptUsed).toBe(detailCall?.prompt);

    for (const marker of ["worn outdoors", "gold earrings lifestyle", "dramatic atmosphere"]) {
      const call = createPrediction.mock.calls
        .map((item) => item[0] as { prompt: string; productImageUrl: string; referenceImageUrl?: string })
        .find((item) => item.prompt.includes(marker));
      expect(call?.productImageUrl).toBe("https://cdn.example/product.jpg");
      expect(call?.referenceImageUrl).toBe("https://cdn.example/latest-face.png");
    }
  });

  it("debits each shot only when that shot starts, and refunds an unsettled hold when time runs out", async () => {
    const events: string[] = [];
    let moderation = 0;
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, `mod_order_${++moderation}`));
    chargeMock.mockImplementation(async (input: { idempotencyKey: string; imageCount: number; gate: { moderationId?: string }; reference: string }) => {
      events.push(`charge:${input.idempotencyKey.split(":").pop()}`);
      return {
        ok: true,
        tier: "PRO",
        balance: 90,
        allotmentConfigured: true,
        hold: {
          accountId: "cca_1",
          transactionId: `cct_${input.idempotencyKey}`,
          amount: input.imageCount,
          moderationId: input.gate.moderationId,
          reference: input.reference,
          idempotencyKey: input.idempotencyKey,
        },
      };
    });
    createPrediction.mockImplementation(async (input: { prompt: string }) => {
      const key = input.prompt.includes("outdoors") ? "in_use" : "lifestyle";
      events.push(`predict:${key}`);
      if (key === "lifestyle") throw new Error("provider exploded");
      return { predictionId: "pred_ok", status: "succeeded", outputs: [{ url: "https://cdn.example/ok.png" }] };
    });
    refundMock.mockImplementation(async (hold: { transactionId: string }) => {
      events.push(`refund:${hold.transactionId.includes("lifestyle") ? "lifestyle" : "other"}`);
      return { reversed: true };
    });

    const res = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      referenceImageUrl: "https://cdn.example/latest-face.png",
      detailTypes: [
        { key: "in_use", prompt: "gold earrings worn outdoors" },
        { key: "lifestyle", prompt: "gold earrings lifestyle" },
      ],
    }));
    expect(res.status).toBe(200);
    expect(events).toEqual([
      "charge:in_use",
      "predict:in_use",
      "charge:lifestyle",
      "predict:lifestyle",
      "refund:lifestyle",
    ]);

    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    dbMock.imageProject.findUnique.mockResolvedValue({ id: "proj_1", userId: "user_1" });
    dbMock.imageProject.update.mockResolvedValue({});
    dbMock.productImage.findUnique.mockResolvedValue({
      id: "img_1",
      s3Key: null,
      originalUrl: "https://cdn.example/product.jpg",
    });
    dbMock.generatedImage.create.mockResolvedValue({ id: "gen_1" });
    dbMock.task.create.mockResolvedValue({ id: "task_1" });
    dbMock.task.count.mockResolvedValue(0);
    refundMock.mockResolvedValue({ reversed: true });
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, "mod_timeout"));
    chargePerImage();
    createPrediction.mockResolvedValue({ predictionId: "pred_wait", status: "processing", outputs: [] });
    let clock = 1_000_000;
    getPrediction.mockImplementation(async () => {
      clock = 1_000_000 + PACK_BUDGET_MS + 1_000;
      return { status: "processing", outputs: [] };
    });

    const timed = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      referenceImageUrl: "https://cdn.example/latest-face.png",
      detailTypes: [
        { key: "in_use", prompt: "gold earrings worn outdoors" },
        { key: "lifestyle", prompt: "gold earrings still waiting" },
        { key: "scene_atmosphere", prompt: "gold earrings atmosphere" },
      ],
      now: () => clock,
      sleep: async () => {},
    });
    const timedJson = await timed.json();
    expect(timed.status).toBe(500);
    // Lifestyle waits for the in-use portrait. The shared clock jumps on that
    // poll, so the later shots never start and are not debited.
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(refundMock).toHaveBeenCalledTimes(1);
    expect(createPrediction).toHaveBeenCalledTimes(1);
    const startedCall = createPrediction.mock.calls[0][0] as { productImageUrl: string; referenceImageUrl?: string };
    expect(startedCall.productImageUrl).toBe("https://cdn.example/product.jpg");
    expect(startedCall.referenceImageUrl).toBe("https://cdn.example/latest-face.png");
    expect(timedJson.creditsCharged).toBe(0);
    expect(timedJson.creditsNotCharged).toBe(2);
    expect(timedJson.failed).toHaveLength(3);
    const failedByKey = Object.fromEntries(timedJson.failed.map((shot: { key: string }) => [shot.key, shot]));
    expect(failedByKey.in_use).toMatchObject({ reason: "prediction_timeout", charged: true, creditsRefunded: true });
    expect(failedByKey.lifestyle).toMatchObject({ reason: NOT_STARTED_REASON, charged: false, creditsRefunded: false });
    expect(failedByKey.scene_atmosphere).toMatchObject({ reason: NOT_STARTED_REASON, charged: false, creditsRefunded: false });
  });

  it("keeps six per-shot waits inside the Hobby 300s cap", () => {
    expect(maxDuration).toBe(300);
    expect(maxDuration).toBe(HOBBY_MAX_DURATION_SECONDS);
    expect(maxDuration).toBeLessThanOrEqual(300);
    expect(PACK_BUDGET_MS + PACK_CLOSE_MARGIN_MS).toBe(maxDuration * 1000);
    expect(PACK_BUDGET_MS).toBeLessThan(maxDuration * 1000);
    expect(PER_SHOT_WAIT_MS * 6).toBeLessThanOrEqual(PACK_BUDGET_MS);
    expect(MIN_START_MS).toBe(PER_SHOT_WAIT_MS);
    expect(MIN_START_MS).toBeGreaterThan(5_000);
  });

  it("keeps polling a debited shot until the pack budget instead of stopping at 40s", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, "mod_keep_polling"));
    chargePerImage();
    createPrediction.mockResolvedValue({ predictionId: "pred_slow", status: "processing", outputs: [] });
    let clock = 1_000_000;
    let polls = 0;
    getPrediction.mockImplementation(async () => {
      polls += 1;
      if (polls === 1) {
        clock = 1_000_000 + PER_SHOT_WAIT_MS + 10_000;
        return { status: "processing", outputs: [] };
      }
      return { status: "succeeded", outputs: [{ url: "https://cdn.example/slow.png" }] };
    });

    const timed = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      detailTypes: [{ key: "multi_angle", prompt: "gold earrings angles" }],
      now: () => clock,
      sleep: async () => {},
    });
    const json = await timed.json();
    expect(polls).toBeGreaterThan(1);
    expect(clock).toBeGreaterThan(1_000_000 + PER_SHOT_WAIT_MS);
    expect(clock).toBeLessThan(1_000_000 + PACK_BUDGET_MS);
    expect(timed.status).toBe(200);
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(refundMock).not.toHaveBeenCalled();
    expect(json.creditsCharged).toBe(1);
    expect(json.failed).toHaveLength(0);
    expect(json.generated[0].url).toBe("https://cdn.example/slow.png");
  });

  it("does not debit a shot when the remaining pack budget is below one shot wait", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, "mod_below_min"));
    chargePerImage();
    let clock = 1_000_000;
    createPrediction.mockImplementation(async () => {
      clock = 1_000_000 + PACK_BUDGET_MS - MIN_START_MS + 1_000;
      return { predictionId: "pred_first", status: "succeeded", outputs: [{ url: "https://cdn.example/first.png" }] };
    });

    const timed = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      detailTypes: [
        { key: "in_use", prompt: "gold earrings worn outdoors" },
        { key: "multi_angle", prompt: "gold earrings angles" },
      ],
      now: () => clock,
    });
    const json = await timed.json();
    expect(timed.status).toBe(200);
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(createPrediction).toHaveBeenCalledTimes(1);
    expect(json.completed).toBe(1);
    expect(json.creditsNotCharged).toBe(1);
    expect(json.failed).toEqual([
      expect.objectContaining({ key: "multi_angle", reason: NOT_STARTED_REASON, charged: false, creditsRefunded: false }),
    ]);
  });

  it("starts the next shot when the remaining pack budget covers one shot wait", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, "mod_at_min"));
    chargePerImage();
    let clock = 1_000_000;
    let started = 0;
    createPrediction.mockImplementation(async () => {
      started += 1;
      if (started === 1) clock = 1_000_000 + PACK_BUDGET_MS - MIN_START_MS;
      return {
        predictionId: `pred_${started}`,
        status: "succeeded",
        outputs: [{ url: `https://cdn.example/${started}.png` }],
      };
    });

    const timed = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      detailTypes: [
        { key: "in_use", prompt: "gold earrings worn outdoors" },
        { key: "multi_angle", prompt: "gold earrings angles" },
      ],
      now: () => clock,
    });
    const json = await timed.json();
    expect(timed.status).toBe(200);
    expect(chargeMock).toHaveBeenCalledTimes(2);
    expect(createPrediction).toHaveBeenCalledTimes(2);
    expect(json.completed).toBe(2);
    expect(json.failed).toHaveLength(0);
    expect(json.creditsCharged).toBe(2);
    expect(json.creditsNotCharged).toBe(0);
  });

  it("stores a late provider image instead of refunding the debit", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, "mod_late"));
    chargePerImage();
    createPrediction.mockResolvedValue({ predictionId: "pred_late", status: "processing", outputs: [] });
    let clock = 5_000;
    let polls = 0;
    getPrediction.mockImplementation(async () => {
      polls += 1;
      if (polls === 1) {
        clock = 5_000 + PACK_BUDGET_MS;
        return { status: "processing", outputs: [] };
      }
      return { status: "succeeded", outputs: [{ url: "https://cdn.example/late.png" }] };
    });

    const timed = await generateDetailPack({
      userId: "user_1",
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      detailTypes: [{ key: "flatlay", prompt: "gold earrings flatlay" }],
      now: () => clock,
    });
    const json = await timed.json();
    expect(timed.status).toBe(200);
    expect(json.completed).toBe(1);
    expect(json.creditsCharged).toBe(1);
    expect(json.creditsRefunded).toBe(0);
    expect(json.generated[0].url).toBe("https://cdn.example/late.png");
    expect(refundMock).not.toHaveBeenCalled();
    const stored = dbMock.generatedImage.create.mock.calls.map((call) => call[0].data);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("SUCCEEDED");
    expect(stored[0].url).toBe("https://cdn.example/late.png");
  });

  it("puts style lock, distinct angles, and no-watermark text on pack prompts", async () => {
    let moderation = 0;
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, `mod_style_${++moderation}`));
    chargePerImage();
    createPrediction.mockResolvedValue({
      predictionId: "pred_style",
      status: "succeeded",
      outputs: [{ url: "https://cdn.example/style.png" }],
    });

    const locked = await generatePost(post("http://localhost/api/generate", fashionPack));
    expect(locked.status).toBe(200);
    const prompts = createPrediction.mock.calls.map((call) => (call[0] as { prompt: string }).prompt);
    expect(prompts).toHaveLength(fashionPack.detailTypes.length);
    for (const prompt of prompts) {
      expect(prompt).toContain(STYLE_LOCK_SAME_PRODUCT);
      expect(prompt).toContain("same material");
      expect(prompt).toContain("same color");
      expect(prompt).toContain("same overall style");
      expect(prompt).toContain(NO_SOURCE_WATERMARK);
      expect(prompt).toContain("AI生成");
      expect(prompt).toContain("即梦AI");
    }
    const multi = prompts.find((prompt) => prompt.includes("gold earrings angles"));
    expect(multi).toContain(MULTI_ANGLE_DISTINCT_VIEWS);
    expect(multi).toContain("true side near 90 degrees");
    expect(multi?.toLowerCase()).toContain("nearly symmetrical");

    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    dbMock.imageProject.findUnique.mockResolvedValue({ id: "proj_1", userId: "user_1" });
    dbMock.imageProject.update.mockResolvedValue({});
    dbMock.productImage.findUnique.mockResolvedValue({
      id: "img_1",
      s3Key: null,
      originalUrl: "https://cdn.example/product.jpg",
    });
    dbMock.generatedImage.create.mockResolvedValue({ id: "gen_1" });
    dbMock.task.create.mockResolvedValue({ id: "task_1" });
    dbMock.task.count.mockResolvedValue(0);
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, "mod_open_style"));
    chargePerImage();
    createPrediction.mockResolvedValue({
      predictionId: "pred_open",
      status: "succeeded",
      outputs: [{ url: "https://cdn.example/open.png" }],
    });
    const open = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      detailTypes: [
        { key: "multi_angle", prompt: "gold earrings angles" },
        { key: "detail", prompt: "gold hoop earring macro" },
      ],
    }));
    expect(open.status).toBe(200);
    const openPrompts = createPrediction.mock.calls.map((call) => (call[0] as { prompt: string }).prompt);
    expect(openPrompts).toHaveLength(2);
    for (const prompt of openPrompts) {
      expect(prompt).not.toContain("Style lock:");
      expect(prompt).toContain(NO_SOURCE_WATERMARK);
    }
    expect(openPrompts[0]).toContain(MULTI_ANGLE_DISTINCT_VIEWS);
  });

  it("uses the product image for apparel detail and the smear prompt only for beauty with a person", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, `mod_beauty_${Math.random()}`));
    chargePerImage();
    createPrediction.mockResolvedValue({
      predictionId: "pred_beauty",
      status: "succeeded",
      outputs: [{ url: "https://cdn.example/beauty.png" }],
    });

    const res = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "beauty",
      baseStyle: "a model applying cream on her face",
      referenceImageUrl: "https://cdn.example/face.png",
      detailTypes: [{ key: "detail", prompt: "serum on the cheek" }],
    }));
    expect(res.status).toBe(200);
    const input = createPrediction.mock.calls[0][0] as { prompt: string; productImageUrl: string };
    expect(input.productImageUrl).toBe("https://cdn.example/product.jpg");
    expect(input.prompt).toContain("on skin");
    expect(input.prompt).not.toContain("serum on the cheek");
  });

  it("does not leave the project GENERATING when the first shot debit is blocked", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, "mod_blocked"));
    chargeMock.mockResolvedValue({
      ok: false,
      error: "insufficient_credits",
      balance: 0,
      required: 1,
      tier: "PRO",
      allotmentConfigured: true,
    });

    const res = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      detailTypes: [
        { key: "in_use", prompt: "gold earrings worn outdoors" },
        { key: "detail", prompt: "gold hoop earring macro" },
      ],
    }));

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe("insufficient_credits");
    expect(createPrediction).not.toHaveBeenCalled();
    expect(refundMock).not.toHaveBeenCalled();

    const updates = dbMock.imageProject.update.mock.calls.map((call) => call[0].data);
    expect(updates.map((data: { status: string }) => data.status)).toEqual(["GENERATING", "FAILED"]);
    expect(updates[1]).toEqual({
      status: "FAILED",
      errorMessage: "insufficient_credits",
    });
  });

  it("stores a FAILED image when polling returns no output", async () => {
    fetchMock.mockResolvedValue(moderationResponse("allow", 200, "mod_poll"));
    chargePerImage();
    createPrediction.mockResolvedValue({ predictionId: "pred_poll", status: "processing", outputs: [] });
    getPrediction.mockResolvedValue({ status: "failed", outputs: [], error: "model rejected" });

    const res = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      detailTypes: [{ key: "detail", prompt: "gold hoop earring macro" }],
    }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.completed).toBe(0);
    expect(json.requested).toBe(1);
    expect(json.failed[0].reason).toBe("model rejected");
    expect(refundMock).toHaveBeenCalledTimes(1);
    const failed = dbMock.generatedImage.create.mock.calls.map((call) => call[0].data);
    expect(failed).toHaveLength(1);
    expect(failed[0].status).toBe("FAILED");
    expect(failed[0].errorMessage).toBe("model rejected");
  });

  it("feeds the in-use portrait to a later single-color color_variants shot", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, `mod_portrait_${Math.random()}`));
    chargePerImage();
    createPrediction.mockImplementation(async (input: { prompt: string }) => {
      const key = input.prompt.includes("worn outdoors") ? "in_use" : "color_variants";
      return {
        predictionId: `pred_${key}`,
        status: "succeeded",
        outputs: [{ url: `https://cdn.example/${key}.png` }],
      };
    });

    const res = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      baseStyle: "金色耳环",
      detailTypes: [
        { key: "in_use", prompt: "gold earrings worn outdoors" },
        { key: "multi_angle", prompt: "gold earrings angles" },
        { key: "color_variants", prompt: "gold earrings colors" },
      ],
    }));
    expect(res.status).toBe(200);
    const calls = createPrediction.mock.calls.map((call) => call[0] as {
      prompt: string;
      productImageUrl: string;
      referenceImageUrl?: string;
    });
    const inUse = calls.find((call) => call.prompt.includes("worn outdoors"));
    const angles = calls.find((call) => call.prompt.includes("gold earrings angles"));
    const colors = calls.find((call) => call.prompt.includes("gold earrings colors"));
    expect(inUse?.productImageUrl).toBe("https://cdn.example/product.jpg");
    expect(inUse?.referenceImageUrl).toBeUndefined();
    expect(angles?.referenceImageUrl).toBeUndefined();
    expect(angles?.prompt).toContain(MULTI_ANGLE_DISTINCT_VIEWS);
    expect(angles?.prompt).toContain(JEWELRY_SILHOUETTE_LOCK);
    expect(angles?.prompt).toContain(NO_UNSEEN_STRUCTURE);
    expect(colors?.productImageUrl).toBe("https://cdn.example/product.jpg");
    expect(colors?.referenceImageUrl).toBe("https://cdn.example/in_use.png");
    expect(colors?.prompt).toContain(PORTRAIT_REFERENCE_LOCK);
    expect(colors?.prompt).toContain(SINGLE_COLOR_MERCHANDISING);
    expect(colors?.prompt.toLowerCase()).not.toContain("horizontal grid");
    expect(colors?.prompt).toContain(STYLE_LOCK_SAME_PRODUCT);
  });

  it("keeps selling points and compare from inventing a brand, a second color, or unseen hardware", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, `mod_case_${Math.random()}`));
    chargePerImage();
    createPrediction.mockResolvedValue({
      predictionId: "pred_case",
      status: "succeeded",
      outputs: [{ url: "https://cdn.example/case.png" }],
    });

    const res = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "electronics",
      baseStyle: "closed white charging case",
      detailTypes: [
        { key: "selling_points", prompt: "core selling points" },
        { key: "compare", prompt: "effect comparison" },
        { key: "multi_angle", prompt: "case angles" },
      ],
    }));
    expect(res.status).toBe(200);
    const prompts = createPrediction.mock.calls.map((call) => (call[0] as { prompt: string }).prompt);
    const selling = prompts.find((prompt) => prompt.includes("caption band"));
    const compare = prompts.find((prompt) => prompt.includes("do not invent a second colorway"));
    const angles = prompts.find((prompt) => prompt.includes("case angles"));
    expect(selling).toContain(SELLING_POINTS_UNCHANGED_PRODUCT);
    expect(selling?.toLowerCase()).not.toContain("neon accent");
    expect(compare).toContain("Split-screen comparison layout");
    expect(compare).toContain("side by side");
    expect(compare).toContain("vertical dividing line centered");
    expect(compare).toContain("identical lighting and scale both sides");
    expect(compare).toContain(COMPARE_ONLY_REAL_ATTRIBUTES);
    expect(compare).toContain("logo");
    expect(angles).toContain(NO_UNSEEN_STRUCTURE);
    expect(angles).toContain("ear post");
    expect(angles?.toLowerCase()).toContain("ports");
  });

  it("separates home usage from atmosphere and refuses invented unboxing accessories", async () => {
    fetchMock.mockImplementation(async () => moderationResponse("allow", 200, `mod_home_${Math.random()}`));
    chargePerImage();
    createPrediction.mockResolvedValue({
      predictionId: "pred_home",
      status: "succeeded",
      outputs: [{ url: "https://cdn.example/home.png" }],
    });

    const res = await generatePost(post("http://localhost/api/generate", {
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "home",
      baseStyle: "enclosed litter box",
      detailTypes: [
        { key: "lifestyle", prompt: "USAGE-MARKER living room" },
        { key: "scene_atmosphere", prompt: "MOOD-MARKER dramatic space" },
        { key: "brand_story", prompt: "UNBOX-MARKER the box" },
      ],
    }));
    expect(res.status).toBe(200);
    const calls = createPrediction.mock.calls.map((call) => call[0] as { prompt: string; referenceImageUrl?: string });
    const lifestyle = calls.find((call) => call.prompt.includes("USAGE-MARKER"));
    const atmosphere = calls.find((call) => call.prompt.includes("MOOD-MARKER"));
    const story = calls.find((call) => call.prompt.includes("UNBOX-MARKER"));
    expect(lifestyle?.prompt).toContain(LIFESTYLE_DISTINCT_COMPOSITION);
    expect(lifestyle?.prompt).toContain(NO_ELECTRONICS_ON_NONELECTRONIC);
    expect(lifestyle?.prompt).toContain(SOURCE_STRUCTURE_LOCK);
    expect(atmosphere?.prompt).toContain(ATMOSPHERE_DISTINCT_COMPOSITION);
    expect(atmosphere?.prompt).not.toContain(LIFESTYLE_DISTINCT_COMPOSITION);
    expect(atmosphere?.prompt.toLowerCase()).not.toContain("warm hygge");
    expect(story?.prompt).toContain(NO_INVENTED_ACCESSORIES);
    expect(story?.prompt).toContain("charging cable");
    expect(lifestyle?.referenceImageUrl).toBeUndefined();
    expect(atmosphere?.referenceImageUrl).toBeUndefined();
  });
});
