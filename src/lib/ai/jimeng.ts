import type { ImageProvider, VideoProvider, ImageGenerationResult, VideoGenerationResult } from "./types";

interface JimengConfig {
  apiKey?: string;
  baseUrl?: string;
}

export function createJimengAdapter(config: JimengConfig = {}) {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://api.jimeng.ai/v1";

  return {
    name: "jimeng",

    async generateImage(prompt: string, referenceImageUrl?: string): Promise<ImageGenerationResult> {
      return generateImage(apiKey, baseUrl, prompt, referenceImageUrl);
    },

    async generateVideo(prompt: string, startImageUrl: string): Promise<VideoGenerationResult> {
      return generateVideo(apiKey, baseUrl, prompt, startImageUrl);
    },
  };
}

export function createJimengImageAdapter(config: JimengConfig = {}): ImageProvider {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://api.jimeng.ai/v1";

  return {
    name: "jimeng",
    async generate(prompt: string, referenceImageUrl?: string): Promise<ImageGenerationResult> {
      return generateImage(apiKey, baseUrl, prompt, referenceImageUrl);
    },
  };
}

export function createJimengVideoAdapter(config: JimengConfig = {}): VideoProvider {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://api.jimeng.ai/v1";

  return {
    name: "jimeng",
    async generate(prompt: string, startImageUrl: string): Promise<VideoGenerationResult> {
      return generateVideo(apiKey, baseUrl, prompt, startImageUrl);
    },
  };
}

async function generateImage(
  apiKey: string | undefined,
  baseUrl: string,
  prompt: string,
  referenceImageUrl?: string
): Promise<ImageGenerationResult> {
  if (!apiKey) throw new Error("JIMENG_API_KEY not configured");

  const response = await fetch(`${baseUrl}/image/generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "seedance-2.0",
      prompt,
      n: 1,
      size: "1080x1920",
      ...(referenceImageUrl ? { reference_image: referenceImageUrl } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Jimeng API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  return {
    url: data.data[0].url,
    thumbnailUrl: data.data[0].url,
    provider: "jimeng",
    metadata: { model: data.model || "seedance-2.0", seed: data.data[0].seed },
  };
}

async function generateVideo(
  apiKey: string | undefined,
  baseUrl: string,
  prompt: string,
  startImageUrl: string
): Promise<VideoGenerationResult> {
  if (!apiKey) throw new Error("JIMENG_API_KEY not configured");

  const response = await fetch(`${baseUrl}/video/generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "seedance-2.0",
      prompt,
      image_url: startImageUrl,
      duration: 5,
      size: "1080x1920",
    }),
  });

  if (!response.ok) {
    throw new Error(`Jimeng API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  return {
    url: data.data[0].url,
    thumbnailUrl: startImageUrl,
    durationSeconds: data.data[0].duration || 5,
    provider: "jimeng",
    metadata: { model: data.model || "seedance-2.0", seed: data.data[0].seed },
  };
}
