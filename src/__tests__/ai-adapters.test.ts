import { describe, it, expect } from "vitest";
import type {
  ImageProvider,
  VideoProvider,
  AudioProvider,
  ScriptProvider,
} from "@/lib/ai/types";

function makeMockImageProvider(): ImageProvider {
  return {
    name: "test-image",
    async generate(prompt: string) {
      return {
        url: `https://example.com/img/${encodeURIComponent(prompt.slice(0, 20))}.png`,
        provider: "test-image",
        metadata: {},
      };
    },
  };
}

function makeMockVideoProvider(): VideoProvider {
  return {
    name: "test-video",
    async generate(prompt: string, startImageUrl: string) {
      return {
        url: `https://example.com/vid/${Date.now()}.mp4`,
        thumbnailUrl: startImageUrl,
        durationSeconds: 5,
        provider: "test-video",
        metadata: {},
      };
    },
  };
}

function makeMockAudioProvider(): AudioProvider {
  return {
    name: "test-tts",
    async generate(text: string) {
      return {
        url: `https://example.com/audio/${encodeURIComponent(text.slice(0, 10))}.mp3`,
        durationSeconds: Math.ceil(text.length / 5),
        provider: "test-tts",
      };
    },
  };
}

function makeMockScriptProvider(): ScriptProvider {
  return {
    name: "test-script",
    async generate(title: string) {
      return {
        scenes: [
          {
            index: 0,
            description: "开场",
            voiceoverText: `这是${title}`,
            imagePrompt: "product shot",
            videoPrompt: "zoom in",
            durationSeconds: 5,
          },
        ],
        voiceover: `这是${title}的介绍`,
        hashtags: ["#test"],
      };
    },
  };
}

describe("AI Adapter pattern", () => {
  it("ImageProvider generates result with required fields", async () => {
    const p = makeMockImageProvider();
    const r = await p.generate("test prompt");
    expect(r.url).toBeTruthy();
    expect(r.provider).toBe("test-image");
  });

  it("VideoProvider generates result with duration and thumbnail", async () => {
    const p = makeMockVideoProvider();
    const r = await p.generate("video prompt", "https://example.com/start.jpg");
    expect(r.url).toBeTruthy();
    expect(r.durationSeconds).toBeGreaterThan(0);
    expect(r.thumbnailUrl).toBeTruthy();
  });

  it("AudioProvider generates result with duration", async () => {
    const p = makeMockAudioProvider();
    const r = await p.generate("配音文本测试");
    expect(r.url).toBeTruthy();
    expect(r.durationSeconds).toBeGreaterThan(0);
  });

  it("ScriptProvider returns scenes with required fields", async () => {
    const p = makeMockScriptProvider();
    const r = await p.generate("测试商品");
    expect(r.scenes).toHaveLength(1);
    expect(r.scenes[0].index).toBe(0);
    expect(r.scenes[0].imagePrompt).toBeTruthy();
    expect(r.scenes[0].videoPrompt).toBeTruthy();
    expect(r.voiceover).toBeTruthy();
    expect(r.hashtags).toContain("#test");
  });

  it("providers are swappable via unified interface", async () => {
    const providers: ImageProvider[] = [makeMockImageProvider(), makeMockImageProvider()];
    const results = await Promise.all(providers.map((p) => p.generate("same prompt")));
    expect(results).toHaveLength(2);
    expect(results[0].provider).toBeDefined();
    expect(results[1].provider).toBeDefined();
  });
});
