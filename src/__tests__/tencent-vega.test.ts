import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VEGA_IMAGE_MODEL,
  DEFAULT_VEGA_LITE_IMAGE_MODEL,
  createTencentVegaProvider,
  isCompleteHttpUrl,
  isTencentVegaConfigured,
  registerTencentVegaProviders,
  tencentVegaEnvKeys,
  vegaGenerationsUrl,
  vegaReferenceImages,
  vegaTaskUrl,
} from "@/lib/ai/tencent-vega";

const API_KEY = "unit-test-placeholder";
const BASE_URL = "https://maas.example.test";
const IMAGE_MODEL = "wand-vega-image-1.5-pro";
const LITE_MODEL = "wand-vega-image-lite";

function mockFetch(status: number, data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  });
}

function stubCompleteEnv() {
  vi.stubEnv("TENCENT_MAAS_API_KEY", API_KEY);
  vi.stubEnv("TENCENT_MAAS_BASE_URL", BASE_URL);
  vi.stubEnv("TENCENT_MAAS_IMAGE_MODEL", IMAGE_MODEL);
  vi.stubEnv("TENCENT_MAAS_LITE_IMAGE_MODEL", LITE_MODEL);
}

function clearVegaEnv() {
  for (const key of tencentVegaEnvKeys()) vi.stubEnv(key, "");
}

beforeEach(() => {
  vi.restoreAllMocks();
  clearVegaEnv();
});

describe("Tencent Vega configuration", () => {
  it("requires the key, both model names, and a complete endpoint", () => {
    expect(tencentVegaEnvKeys()).toEqual([
      "TENCENT_MAAS_API_KEY",
      "TENCENT_MAAS_BASE_URL",
      "TENCENT_MAAS_IMAGE_MODEL",
      "TENCENT_MAAS_LITE_IMAGE_MODEL",
    ]);
    expect(isTencentVegaConfigured()).toBe(false);

    stubCompleteEnv();
    expect(isTencentVegaConfigured()).toBe(true);
    expect(DEFAULT_VEGA_IMAGE_MODEL).toBe(IMAGE_MODEL);
    expect(DEFAULT_VEGA_LITE_IMAGE_MODEL).toBe(LITE_MODEL);

    for (const key of tencentVegaEnvKeys()) {
      stubCompleteEnv();
      vi.stubEnv(key, "   ");
      expect(isTencentVegaConfigured(), key).toBe(false);
    }

    stubCompleteEnv();
    vi.stubEnv("TENCENT_MAAS_BASE_URL", "tokenhub.example.test");
    expect(isCompleteHttpUrl("tokenhub.example.test")).toBe(false);
    expect(isTencentVegaConfigured()).toBe(false);

    stubCompleteEnv();
    vi.stubEnv("TENCENT_MAAS_BASE_URL", "https://");
    expect(isTencentVegaConfigured()).toBe(false);
  });

  it("registers vega and vega-lite only when the endpoint is complete", async () => {
    const blocked = vi.fn();
    expect(registerTencentVegaProviders(blocked)).toBe(false);
    expect(blocked).not.toHaveBeenCalled();

    stubCompleteEnv();
    vi.stubEnv("TENCENT_MAAS_LITE_IMAGE_MODEL", "");
    expect(registerTencentVegaProviders(blocked)).toBe(false);
    expect(blocked).not.toHaveBeenCalled();

    stubCompleteEnv();
    vi.stubEnv("TENCENT_MAAS_BASE_URL", "tokenhub.example.test");
    expect(registerTencentVegaProviders(blocked)).toBe(false);
    expect(blocked).not.toHaveBeenCalled();

    const registerProvider = vi.fn();
    vi.resetModules();
    vi.doMock("@/lib/ai/registry", () => ({ registerProvider }));
    stubCompleteEnv();

    const { initProviders } = await import("@/lib/ai/init");
    initProviders();

    const vega = registerProvider.mock.calls.find((call) => call[0] === "vega")?.[1];
    const lite = registerProvider.mock.calls.find((call) => call[0] === "vega-lite")?.[1];
    expect(vega?.name).toBe("tencent-vega");
    expect(lite?.name).toBe("tencent-vega");

    const fetchMock = mockFetch(200, { task_id: "task_pro" });
    vi.stubGlobal("fetch", fetchMock);
    await vega.createPrediction({
      prompt: "pack shot",
      productImageUrl: "https://cdn.example/product.jpg",
      referenceImageUrl: "https://cdn.example/style.jpg",
      modelVersion: "black-forest-labs/flux-2-pro",
    });
    const proBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(proBody.model).toBe(IMAGE_MODEL);
    expect(proBody.model).not.toBe("black-forest-labs/flux-2-pro");

    fetchMock.mockClear();
    await lite.createPrediction({
      prompt: "lite",
      productImageUrl: "https://cdn.example/product.jpg",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(LITE_MODEL);

    vi.resetModules();
    const skipped = vi.fn();
    vi.doMock("@/lib/ai/registry", () => ({ registerProvider: skipped }));
    clearVegaEnv();
    const again = await import("@/lib/ai/init");
    again.initProviders();
    expect(skipped.mock.calls.map((call) => call[0])).not.toContain("vega");
    expect(skipped.mock.calls.map((call) => call[0])).not.toContain("vega-lite");

    vi.doUnmock("@/lib/ai/registry");
  });
});

describe("Tencent Vega provider", () => {
  it("posts the product image and then the style reference", async () => {
    const fetchMock = mockFetch(200, { task_id: "task_1", request_id: "req_1" });
    vi.stubGlobal("fetch", fetchMock);
    const provider = createTencentVegaProvider({
      apiKey: API_KEY,
      baseUrl: `${BASE_URL}/`,
      model: IMAGE_MODEL,
    });

    const created = await provider.createPrediction({
      prompt: "lifestyle catalog",
      productImageUrl: "https://cdn.example/product.jpg",
      referenceImageUrl: "https://cdn.example/style.jpg",
      width: 1024,
      height: 1024,
    });

    expect(created).toEqual({
      predictionId: "task_1",
      status: "processing",
      webhookId: "task_1",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(vegaGenerationsUrl(BASE_URL));
    expect(url).toBe("https://maas.example.test/v1/wand/vega-images/generations");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      model: IMAGE_MODEL,
      prompt: "lifestyle catalog",
      size: "1024x1024",
      input: [
        {
          content: [
            { type: "input_image", image_url: "https://cdn.example/product.jpg" },
            { type: "input_image", image_url: "https://cdn.example/style.jpg" },
          ],
        },
      ],
    });
    expect(init.body).not.toContain(API_KEY);
  });

  it("accepts an origin, a /v1 prefix, or the full generations URL", () => {
    expect(vegaGenerationsUrl("https://maas.example.test/v1")).toBe(
      "https://maas.example.test/v1/wand/vega-images/generations",
    );
    expect(vegaGenerationsUrl("https://maas.example.test/v1/wand/vega-images/generations")).toBe(
      "https://maas.example.test/v1/wand/vega-images/generations",
    );
    expect(vegaTaskUrl("https://maas.example.test", "task/1")).toBe(
      "https://maas.example.test/v1/wand/vega-images/tasks/task%2F1",
    );
  });

  it("sends only the product image when there is no style reference", () => {
    expect(vegaReferenceImages({
      prompt: "macro",
      productImageUrl: "https://cdn.example/product.jpg",
    })).toEqual(["https://cdn.example/product.jpg"]);
    expect(vegaReferenceImages({
      prompt: "macro",
      productImageUrl: "https://cdn.example/product.jpg",
      referenceImageUrl: "https://cdn.example/product.jpg",
    })).toEqual(["https://cdn.example/product.jpg"]);
  });

  it("uses the public default model when no model is configured", async () => {
    const fetchMock = mockFetch(200, { task_id: "task_default" });
    vi.stubGlobal("fetch", fetchMock);
    const provider = createTencentVegaProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
    });
    await provider.createPrediction({
      prompt: "default model",
      productImageUrl: "https://cdn.example/product.jpg",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(DEFAULT_VEGA_IMAGE_MODEL);
  });

  it("polls the task and maps completed, queued, and failed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          status: "completed",
          data: [{ url: "https://cdn.example/out.png" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "in_progress" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "queued" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "failed", error: `rejected ${API_KEY}` }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const provider = createTencentVegaProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      model: IMAGE_MODEL,
    });

    const done = await provider.getPrediction("task_1");
    expect(done.status).toBe("succeeded");
    expect(done.outputs[0].url).toBe("https://cdn.example/out.png");
    expect(fetchMock.mock.calls[0][0]).toBe(vegaTaskUrl(BASE_URL, "task_1"));

    expect((await provider.getPrediction("task_1")).status).toBe("processing");
    expect((await provider.getPrediction("task_1")).status).toBe("processing");

    const failed = await provider.getPrediction("task_1");
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("rejected [redacted]");
    expect(failed.error).not.toContain(API_KEY);
  });

  it("does not repeat the placeholder key in an HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch(401, { error: `invalid ${API_KEY}` }));
    const provider = createTencentVegaProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      model: IMAGE_MODEL,
    });
    await expect(provider.createPrediction({
      prompt: "nope",
      productImageUrl: "https://cdn.example/product.jpg",
    })).rejects.toThrow(/Vega API error: 401/);
    await expect(provider.createPrediction({
      prompt: "nope",
      productImageUrl: "https://cdn.example/product.jpg",
    })).rejects.toThrow(/\[redacted\]/);
  });

  it("throws when the key or endpoint is missing", () => {
    expect(() => createTencentVegaProvider({ apiKey: "", baseUrl: BASE_URL })).toThrow(
      "TENCENT_MAAS_API_KEY is required",
    );
    expect(() => createTencentVegaProvider({ apiKey: API_KEY, baseUrl: "not-a-url" })).toThrow(
      "TENCENT_MAAS_BASE_URL is required",
    );
  });
});
