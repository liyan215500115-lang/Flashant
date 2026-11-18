import { beforeEach, describe, expect, it, vi } from "vitest";
import { STYLE_PROMPTS } from "@/lib/ai/style-prompts";

const { authMock, dbMock, chargeMock, refundMock, getProviderMock, createPrediction, signedUrl } = vi.hoisted(() => {
  const createPrediction = vi.fn();
  return {
    createPrediction,
    authMock: vi.fn(),
    chargeMock: vi.fn(),
    refundMock: vi.fn(),
    getProviderMock: vi.fn(() => ({ createPrediction, getPrediction: vi.fn() })),
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

import { POST as generatePost } from "@/app/api/generate/route";
import { POST as batchPost } from "@/app/api/generate/batch/route";

const fetchMock = vi.fn();

function moderationResponse(decision: string, status = 200) {
  return new Response(JSON.stringify({ decision, id: "mod_1", object: "moderation_result" }), {
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
