import { describe, it, expect, beforeEach, vi } from "vitest";
import { createReplicateProvider } from "@/lib/ai/replicate";

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status: number, data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

describe("replicate provider", () => {
  describe("createPrediction", () => {
    it("returns predictionId on success", async () => {
      const mock = mockFetch(201, {
        id: "pred_abc123",
        status: "starting",
      });
      vi.stubGlobal("fetch", mock);

      const provider = createReplicateProvider({ apiKey: "test-key" });
      const result = await provider.createPrediction({
        prompt: "test prompt",
        productImageUrl: "https://example.com/img.png",
      });

      expect(result.predictionId).toBe("pred_abc123");
      expect(result.status).toBe("processing"); // "starting" maps to "processing"
      expect(result.webhookId).toBe("pred_abc123");

      const [url, init] = mock.mock.calls[0];
      expect(url).toBe("https://api.replicate.com/v1/predictions");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer test-key");
    });

    it("throws on API error (500)", async () => {
      vi.stubGlobal("fetch", mockFetch(500, { error: "Internal Server Error" }));

      const provider = createReplicateProvider({ apiKey: "test-key" });
      await expect(
        provider.createPrediction({
          prompt: "test",
          productImageUrl: "https://example.com/img.png",
        })
      ).rejects.toThrow("Replicate API error: 500");
    });

    it("throws on API error (401)", async () => {
      vi.stubGlobal("fetch", mockFetch(401, { error: "Invalid token" }));

      const provider = createReplicateProvider({ apiKey: "bad-key" });
      await expect(
        provider.createPrediction({
          prompt: "test",
          productImageUrl: "https://example.com/img.png",
        })
      ).rejects.toThrow("Replicate API error: 401");
    });

    it("includes webhook URL when configured", async () => {
      const mock = mockFetch(201, { id: "pred_xyz", status: "processing" });
      vi.stubGlobal("fetch", mock);

      const provider = createReplicateProvider({
        apiKey: "test-key",
        webhookUrl: "https://example.com/webhook",
      });
      await provider.createPrediction({
        prompt: "test",
        productImageUrl: "https://example.com/img.png",
      });

      const [, init] = mock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.webhook).toBe("https://example.com/webhook");
      expect(body.webhook_events_filter).toEqual(["completed"]);
    });

    it("throws when API key is missing", () => {
      expect(() =>
        createReplicateProvider({ apiKey: "" })
      ).toThrow("REPLICATE_API_KEY is required");
    });
  });

  describe("getPrediction", () => {
    it("returns succeeded status with outputs", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {
        id: "pred_abc",
        status: "succeeded",
        output: ["https://replicate.com/output/1.png", "https://replicate.com/output/2.png"],
      }));

      const provider = createReplicateProvider({ apiKey: "test-key" });
      const result = await provider.getPrediction("pred_abc");

      expect(result.status).toBe("succeeded");
      expect(result.outputs).toHaveLength(2);
      expect(result.outputs[0].url).toBe("https://replicate.com/output/1.png");
      expect(result.outputs[0].id).toBe("pred_abc_0");
      expect(result.outputs[1].id).toBe("pred_abc_1");
    });

    it("returns failed status with error message", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {
        id: "pred_fail",
        status: "failed",
        error: "GPU out of memory",
      }));

      const provider = createReplicateProvider({ apiKey: "test-key" });
      const result = await provider.getPrediction("pred_fail");

      expect(result.status).toBe("failed");
      expect(result.outputs).toHaveLength(0);
      expect(result.error).toBe("GPU out of memory");
    });

    it("returns processing status for in-progress predictions", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {
        id: "pred_proc",
        status: "processing",
      }));

      const provider = createReplicateProvider({ apiKey: "test-key" });
      const result = await provider.getPrediction("pred_proc");

      expect(result.status).toBe("processing");
      expect(result.outputs).toHaveLength(0);
    });
  });

  describe("isReady", () => {
    it("returns true when prediction succeeded", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {
        id: "pred_rdy",
        status: "succeeded",
        output: ["https://example.com/img.png"],
      }));

      const provider = createReplicateProvider({ apiKey: "test-key" });
      expect(await provider.isReady("pred_rdy")).toBe(true);
    });

    it("returns false when prediction is still processing", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {
        id: "pred_busy",
        status: "processing",
      }));

      const provider = createReplicateProvider({ apiKey: "test-key" });
      expect(await provider.isReady("pred_busy")).toBe(false);
    });
  });
});
