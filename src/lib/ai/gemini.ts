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
      // Prepend product fidelity instruction — critical for img2img to keep the product identical
      const fidelityPrefix = [
        "CRITICAL: The image below is the product reference.",
        "Generate a new image where the product itself is visually IDENTICAL to the reference — same shape, same color, same materials, same details, same proportions.",
        "You may change ONLY: the background, scene, lighting, angle/perspective (slightly), and surrounding context.",
        "If the reference shows a specific object, the output MUST show exactly that object, not a similar substitute.",
        "Do NOT alter the product's identity.",
      ].join(" ");

      const enhancedPrompt = `${fidelityPrefix}\n\nOutput instructions: ${input.prompt}`;

      // Build request body for images/generations endpoint
      const requestBody: Record<string, unknown> = {
        model,
        prompt: enhancedPrompt,
        n: input.numOutputs ?? 1,
        size: `${input.width ?? 1024}x${input.height ?? 1024}`,
        response_format: "b64_json",
      };

      // Pass product image as reference when available (model-dependent support)
      if (input.productImageUrl) {
        const imgResponse = await fetch(input.productImageUrl);
        const imgBuffer = await imgResponse.arrayBuffer();
        const base64Image = Buffer.from(imgBuffer).toString("base64");
        const mimeType = imgResponse.headers.get("content-type") ?? "image/png";
        requestBody.image = `data:${mimeType};base64,${base64Image}`;
      }

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
