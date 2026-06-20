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
      // flux-2-pro input schema (verified against Replicate API 2026-06):
      //   aspect_ratio (default "1:1") — width/height ONLY apply when set to "custom"
      //   input_images — img2img reference(s), max 8
      //   seed — reproducible generation (best-effort; not pixel-identical)
      //   output_format / output_quality / safety_tolerance / resolution
      // NOTE: flux-2-pro has NO num_outputs param — one image per prediction (caller loops).
      const inputPayload: Record<string, unknown> = {
        prompt: input.prompt,
        // Custom ratio so width/height take effect; otherwise Replicate ignores them (always 1:1)
        aspect_ratio: "custom",
        width: input.width ?? 1024,
        height: input.height ?? 1024,
        output_format: "png",
        output_quality: 90,
        safety_tolerance: 2,
      };

      // Pass product photo as reference — prompt controls scene change
      if (input.productImageUrl) {
        inputPayload.input_images = [input.productImageUrl];
      }

      // Best-effort seed for style consistency (lockStyle). Not pixel-reproducible on flux-2-pro,
      // but stabilizes the generation tendency vs. leaving it fully random.
      if (input.seed != null) {
        inputPayload.seed = input.seed;
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
        // flux-2-pro returns a single URL string; accept string[] too for safety
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
