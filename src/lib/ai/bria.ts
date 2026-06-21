import "server-only";

import type { ImageProvider, ImageGenerationInput, ImageGenerationResult } from "./types";

interface BriaConfig {
  apiKey: string;
  modelVersion: string;
  timeoutMs?: number;
}

// bria/generate-background on Replicate — purpose-built for e-commerce product
// photography: takes a product image + a background prompt, preserves the product
// and renders a new scene around it. Verified better fit than flux-2-pro for the
// "upload product photo → swap background" flow, and likely cheaper (~$0.003-0.004
// per run vs flux-2-pro ~$0.045). Registered as the "bria" backup engine.
//
// Input schema (bria V2): image_url (product) + bg_prompt (background description).
// Deprecated params (force_rmbg / fast / enhance_ref_image) are NOT used.
// Output: a list of signed Replicate delivery URLs.

export function createBriaProvider(config?: Partial<BriaConfig>): ImageProvider {
  const apiKey = config?.apiKey ?? process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    throw new Error("REPLICATE_API_KEY is required");
  }

  const modelVersion =
    config?.modelVersion ??
    "2555256f9a283b27092a99741d35251c180d6712e572d19a1c3912b45c80c995"; // bria/generate-background latest
  const timeoutMs = config?.timeoutMs ?? 60_000;
  const baseUrl = "https://api.replicate.com/v1";

  return {
    name: "bria",

    async createPrediction(input: ImageGenerationInput) {
      // bria preserves the product automatically — the prompt only needs to describe
      // the desired background/scene, NOT "keep the product identical" (that instruction
      // is irrelevant to bria and can even confuse it). Use the prompt as-is.
      const inputPayload: Record<string, unknown> = {
        image_url: input.productImageUrl,
        bg_prompt: input.prompt,
        refine_prompt: true,
        seed: input.seed ?? 42,
      };

      const body: Record<string, unknown> = {
        version: modelVersion,
        input: inputPayload,
      };

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
        throw new Error(`Bria API error: ${res.status} ${err}`);
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
        throw new Error(`Bria API error: ${res.status} ${err}`);
      }

      const data = await res.json();

      if (data.status === "succeeded") {
        // bria returns a list of URL strings
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
