import "server-only";

import type { ImageProvider, ImageGenerationInput, ImageGenerationResult } from "./types";

interface ReplicateConfig {
  apiKey: string;
  modelVersion: string;
  webhookUrl?: string;
  timeoutMs?: number;
}

export function createReplicateProvider(config?: Partial<ReplicateConfig>): ImageProvider {
  const apiKey = config?.apiKey ?? process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    throw new Error("REPLICATE_API_KEY is required");
  }

  const modelVersion =
    config?.modelVersion ??
    process.env.REPLICATE_MODEL_VERSION ??
    "black-forest-labs/flux-2-pro";
  const webhookUrl = config?.webhookUrl ?? process.env.REPLICATE_WEBHOOK_URL;
  const timeoutMs = config?.timeoutMs ?? 60_000;
  const baseUrl = "https://api.replicate.com/v1";

  return {
    name: "replicate",

    async createPrediction(input: ImageGenerationInput) {
      const inputPayload: Record<string, unknown> = {
        prompt: input.prompt,
        aspect_ratio: "1:1",
        output_format: "png",
        output_quality: 90,
        safety_tolerance: 2,
      };

      // Pass product photo as reference — prompt controls scene change
      if (input.productImageUrl) {
        inputPayload.input_images = [input.productImageUrl];
      }

      const version = input.modelVersion || modelVersion;
      const body: Record<string, unknown> = {
        version,
        input: inputPayload,
      };

      if (webhookUrl) {
        body.webhook = webhookUrl;
        body.webhook_events_filter = ["completed"];
      }

      const res = await fetch(`${baseUrl}/predictions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Replicate API error: ${res.status} ${err}`);
      }

      const data = await res.json();

      return {
        predictionId: data.id,
        status: "processing",
        webhookId: data.id,
      };
    },

    async getPrediction(predictionId: string): Promise<ImageGenerationResult> {
      const res = await fetch(`${baseUrl}/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Replicate API error: ${res.status} ${err}`);
      }

      const data = await res.json();

      if (data.status === "succeeded") {
        // FLUX 1.1 Pro returns a single URL string; schnell returns string[]
        const raw = data.output;
        const urls: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

        const outputs: ImageGenerationResult["outputs"] = urls.map(
          (url: string, i: number) => ({
            id: `${predictionId}_${i}`,
            url,
            width: 1024,
            height: 1024,
            fileSize: 0,
            mimeType: "image/png",
          })
        );
        return { outputs, status: "succeeded" };
      }

      if (data.status === "failed" || data.status === "canceled") {
        return {
          outputs: [],
          status: "failed",
          error: data.error ?? "Unknown error",
        };
      }

      return { outputs: [], status: "processing" };
    },

    async isReady(predictionId: string): Promise<boolean> {
      const result = await this.getPrediction(predictionId);
      return result.status === "succeeded";
    },
  };
}
