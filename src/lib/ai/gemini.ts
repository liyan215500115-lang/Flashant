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
  const baseUrl = config?.apiKey ? "https://api.laozhang.ai/v1" : "https://generativelanguage.googleapis.com/v1beta";
  const model = config?.model ?? "gemini-3.1-flash-image";
  const timeoutMs = config?.timeoutMs ?? 30_000;

  return {
    name: "gemini",

    async createPrediction(input: ImageGenerationInput) {
      const imgResponse = await fetch(input.productImageUrl);
      const imgBuffer = await imgResponse.arrayBuffer();
      const base64Image = Buffer.from(imgBuffer).toString("base64");
      const mimeType = imgResponse.headers.get("content-type") ?? "image/png";

      // Prepend product fidelity instruction — critical for img2img to keep the product identical
      const fidelityPrefix = [
        "CRITICAL: The image below is the product reference.",
        "Generate a new image where the product itself is visually IDENTICAL to the reference — same shape, same color, same materials, same details, same proportions.",
        "You may change ONLY: the background, scene, lighting, angle/perspective (slightly), and surrounding context.",
        "If the reference shows a specific object, the output MUST show exactly that object, not a similar substitute.",
        "Do NOT alter the product's identity.",
      ].join(" ");

      const enhancedPrompt = `${fidelityPrefix}\n\nOutput instructions: ${input.prompt}`;

      const requestBody = {
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: enhancedPrompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
        max_tokens: 4096,
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
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
      const content = data.choices?.[0]?.message?.content ?? "";

      // Gemini returns base64 data URI: ![image](data:image/jpeg;base64,...)
      let imageUrl = "";
      const base64Match = content.match(/!\[.*?\]\(data:image\/[^;]+;base64,([^)]+)\)/);
      const urlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);

      if (base64Match) {
        // Convert base64 to URL via fetch
        imageUrl = `data:image/png;base64,${base64Match[1]}`;
      } else if (urlMatch) {
        imageUrl = urlMatch[1];
      }

      return {
        predictionId: data.id ?? `gemini-${Date.now()}`,
        status: imageUrl ? "succeeded" : "failed",
        outputs: imageUrl ? [{ id: "0", url: imageUrl, width: 1024, height: 1024, fileSize: 0, mimeType: "image/png" }] : [],
      };
    },

    async getPrediction(predictionId: string): Promise<ImageGenerationResult> {
      // Gemini is synchronous — no polling needed
      return { outputs: [], status: "processing" };
    },

    async isReady(): Promise<boolean> {
      return true;
    },
  };
}
