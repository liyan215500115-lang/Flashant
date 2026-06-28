import "server-only";

import OpenAI from "openai";
import type { ImageProvider, ImageGenerationInput, ImageGenerationResult } from "./types";
import { createSocksFetch } from "./socks-fetch";

export function createOpenAIProvider(): ImageProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const client = new OpenAI({ apiKey, fetch: createSocksFetch() });

  return {
    name: "openai",

    async createPrediction(input: ImageGenerationInput) {
      // GPT Image 2 supports img2img via the `image` parameter (base64 data URL).
      let imageBase64: string | undefined;
      if (input.productImageUrl) {
        try {
          const res = await fetch(input.productImageUrl);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const mime = res.headers.get("content-type") || "image/png";
            imageBase64 = `data:${mime};base64,${buf.toString("base64")}`;
          }
        } catch { /* skip img2img if download fails */ }
      }

      const response = await client.images.generate({
        model: "gpt-image-2",
        prompt: input.prompt,
        n: 1,
        size: "1024x1024",
        ...(imageBase64 ? { image: imageBase64 } as any : {}),
      });

      const url = response.data?.[0]?.url;
      if (!url) throw new Error("OpenAI returned no image URL");

      return {
        predictionId: `openai_${Date.now()}`,
        status: "succeeded" as const,
        openaiUrl: url,
      };
    },

    async getPrediction(predictionId: string): Promise<ImageGenerationResult> {
      // OpenAI images.generate is synchronous — the URL is stored on the task/GeneratedImage.
      // This method exists for interface compliance but shouldn't be called in normal flow.
      return {
        outputs: [],
        status: "succeeded",
      };
    },

    async isReady(): Promise<boolean> {
      return true;
    },
  };
}
