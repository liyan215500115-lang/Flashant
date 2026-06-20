import "server-only";

import type { ImageProvider, ImageGenerationInput, ImageGenerationResult } from "./types";

interface GeminiConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export function createGeminiProvider(config?: Partial<GeminiConfig>): ImageProvider {
  const apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.NANO_BANANA_API_KEY;
  if (!apiKey) throw new Error("Gemini API key required");
  const baseUrl = "https://api.laozhang.ai/v1";
  // seedream supports img2img (image parameter) — other models don't
  const model = config?.model ?? "seedream-4-5-251128";
  const timeoutMs = config?.timeoutMs ?? 120_000;

  return {
    name: "gemini",

    async createPrediction(input: ImageGenerationInput) {
      // Seedream does img2img via the `image` parameter — keep the prompt scene-focused
      // The reference image handles product identity; the prompt should only describe the desired background/scene/lighting
      const prompt = input.prompt;

      // Build request body for images/generations endpoint
      const requestBody: Record<string, unknown> = {
        model,
        prompt,
        n: 1,
        size: `${input.width ?? 1024}x${input.height ?? 1024}`,
        response_format: "b64_json",
        watermark: false,
      };

      // Laozhang.ai does NOT support image/img2img parameter on any model
      // Product consistency relies on prompt description only for Gemini-based engines

      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${err}`);
      }

      const data = await res.json();
      const images: Array<Record<string, unknown>> = data.data ?? [];

      if (images.length === 0) {
        return { predictionId: `gemini-${Date.now()}`, status: "failed", error: "No images returned" };
      }

      const outputs: ImageGenerationResult["outputs"] = images.map(
        (img: Record<string, unknown>, i: number) => {
          // Laozhang.ai returns b64_json in data URL format or raw base64
          const b64 = (img.b64_json ?? img.url ?? "") as string;
          const url = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
          return {
            id: `${Date.now()}_${i}`,
            url,
            width: (input.width ?? 1024),
            height: (input.height ?? 1024),
            fileSize: 0,
            mimeType: "image/png",
          };
        }
      );

      return {
        predictionId: data.id ?? `gemini-${Date.now()}`,
        status: "succeeded",
        outputs,
      };
    },

    async getPrediction(predictionId: string): Promise<ImageGenerationResult> {
      // Gemini via laozhang.ai is synchronous — no polling needed
      return { outputs: [], status: "processing" };
    },

    async isReady(): Promise<boolean> {
      return true;
    },
  };
}
