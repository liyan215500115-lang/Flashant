import { beforeEach, describe, expect, it, vi } from "vitest";
import { STYLE_PROMPTS } from "@/lib/ai/style-prompts";

const { authMock, dbMock, quotaMock, getProviderMock, createPrediction, signedUrl } = vi.hoisted(() => {
  const createPrediction = vi.fn();
  return {
    createPrediction,
    authMock: vi.fn(),
    quotaMock: vi.fn(),
    getProviderMock: vi.fn(() => ({ createPrediction, getPrediction: vi.fn() })),
    signedUrl: vi.fn(async () => "https://cdn.example/signed.jpg"),
    dbMock: {
      imageProject: { findUnique: vi.fn(), update: vi.fn() },
      task: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      productImage: { findUnique: vi.fn() },
      generatedImage: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
      brandPreset: { findUnique: vi.fn() },
      promptTemplate: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/lemonsqueezy/billing", () => ({ checkGenerationQuota: quotaMock }));
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
  quotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 100, tier: "PRO" });
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

  it("does not screen an unmodified style template and still generates", async () => {
    const style = STYLE_PROMPTS.find((item) => item.key === "white")!.promptFlux;
    const res = await generatePost(post("http://localhost/api/generate", { ...body, prompt: style }));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createPrediction).toHaveBeenCalled();
  });

  it("does not screen a catalog template selected by id", async () => {
    const res = await generatePost(
      post("http://localhost/api/generate", {
        imageProjectId: "proj_1",
        productImageId: "img_1",
        promptTemplateId: "tpl_1",
        numOutputs: 1,
      }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createPrediction).toHaveBeenCalled();
    expect(createPrediction.mock.calls[0][0].prompt).toContain("Kinfolk/Cereal");
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

  it("uses the static fallback without calling Creem when the prompt is empty", async () => {
    const res = await batchPost(
      post("http://localhost/api/generate/batch", { ...body, prompt: "" }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createPrediction.mock.calls[0][0].prompt).toBe("Professional product photography");
  });
});
