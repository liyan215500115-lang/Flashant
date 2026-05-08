import type { AudioProvider, AudioGenerationResult } from "./types";

interface TTSConfig {
  apiKey?: string;
  baseUrl?: string;
}

export function createTTSAdapter(config: TTSConfig = {}): AudioProvider {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://openspeech.bytedance.com/api/v1";

  return {
    name: "volcano-tts",

    async generate(text: string): Promise<AudioGenerationResult> {
      if (!apiKey) throw new Error("TTS_API_KEY not configured");

      const response = await fetch(`${baseUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text,
          voice_type: "zh_female_vivid",
          encoding: "mp3",
          speed_ratio: 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();

      return {
        url: data.data.audio_url,
        durationSeconds: data.data.duration || 0,
        provider: "volcano-tts",
      };
    },
  };
}
