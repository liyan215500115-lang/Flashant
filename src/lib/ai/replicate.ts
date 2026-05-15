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
    "black-forest-labs/flux-schnell";
  const webhookUrl = config?.webhookUrl ?? process.env.REPLICATE_WEBHOOK_URL;
  const timeoutMs = config?.timeoutMs ?? 30_000;
  const baseUrl = "https://api.replicate.com/v1";

  return {
    name: "replicate",

    async createPrediction(input: ImageGenerationInput) {
      const body: Record<string, unknown> = {
        version: modelVersion,
        input: {
          prompt: input.prompt,
          image: input.productImageUrl,
          num_outputs: input.numOutputs ?? 2,
          width: input.width ?? 1024,
          height: input.height ?? 1024,
        },
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
        status: data.status === "starting" ? "processing" : data.status,
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
        const outputs: ImageGenerationResult["outputs"] = (
          data.output as string[]
        ).map((url: string, i: number) => ({
          id: `${predictionId}_${i}`,
          url,
          width: 1024,
          height: 1024,
          fileSize: 0,
          mimeType: "image/png",
        }));
        return { outputs, status: "succeeded" };
      }

      if (data.status === "failed" || data.status === "canceled") {
        return { outputs: [], status: "failed", error: data.error ?? "Unknown error" };
      }

      return { outputs: [], status: "processing" };
    },

    async isReady(predictionId: string): Promise<boolean> {
      const result = await this.getPrediction(predictionId);
      return result.status === "succeeded";
    },
  };
}
