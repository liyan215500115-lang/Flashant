import type { ImageProvider, VideoProvider, ImageGenerationResult, VideoGenerationResult } from "./types";

interface KlingConfig {
  apiKey?: string;
  baseUrl?: string;
}

export function createKlingImageAdapter(config: KlingConfig = {}): ImageProvider {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://api.kling.ai/v1";

  return {
    name: "kling",
    async generate(prompt: string, referenceImageUrl?: string): Promise<ImageGenerationResult> {
      if (!apiKey) throw new Error("KLING_API_KEY not configured");

      const response = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "kling-v1",
          prompt,
          n: 1,
          size: "1080x1920",
          ...(referenceImageUrl ? { reference_image: referenceImageUrl } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`Kling API error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();

      return {
        url: data.data[0].url,
        thumbnailUrl: data.data[0].url,
        provider: "kling",
        metadata: { model: "kling-v1" },
      };
    },
  };
}

export function createKlingVideoAdapter(config: KlingConfig = {}): VideoProvider {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://api.kling.ai/v1";

  return {
    name: "kling",
    async generate(prompt: string, startImageUrl: string): Promise<VideoGenerationResult> {
      if (!apiKey) throw new Error("KLING_API_KEY not configured");

      const response = await fetch(`${baseUrl}/videos/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "kling-v1",
          prompt,
          image_url: startImageUrl,
          duration: 5,
          size: "1080x1920",
        }),
      });

      if (!response.ok) {
        throw new Error(`Kling API error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();

      return {
        url: data.data[0].url,
        thumbnailUrl: startImageUrl,
        durationSeconds: data.data[0].duration || 5,
        provider: "kling",
        metadata: { model: "kling-v1" },
      };
    },
  };
}
