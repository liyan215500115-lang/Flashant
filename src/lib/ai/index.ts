import { createClaudeAdapter } from "./claude";
import { createJimengImageAdapter, createJimengVideoAdapter } from "./jimeng";
import { createTTSAdapter } from "./tts";
import { env } from "@/lib/env";
import type {
  ImageProvider,
  VideoProvider,
  AudioProvider,
  ScriptProvider,
  ImageGenerationResult,
  VideoGenerationResult,
  AudioGenerationResult,
  ScriptGenerationResult,
} from "./types";

function mockScriptProvider(): ScriptProvider {
  return {
    name: "mock-claude",
    async generate(title: string): Promise<ScriptGenerationResult> {
      await new Promise((r) => setTimeout(r, 800));
      return {
        scenes: [
          {
            index: 0,
            description: `开场展示${title}整体外观，镜头由远及近`,
            voiceoverText: `今天给大家带来这款超值的${title}，性价比真的太高了！`,
            imagePrompt: `Product photography of ${title}, studio lighting, white background, 1080x1920 portrait, commercial photography style, clean and professional`,
            videoPrompt: `Slow zoom in on ${title}, soft camera movement, elegant product reveal`,
            durationSeconds: 5,
          },
          {
            index: 1,
            description: "细节特写，展示产品核心卖点",
            voiceoverText: "看这个做工，细节处理得特别好，用起来非常方便。",
            imagePrompt: `Close-up detail shot of ${title}, macro photography, shallow depth of field, highlighting texture and quality, 1080x1920`,
            videoPrompt: `Smooth pan across product details, macro focus pull, highlighting craftsmanship`,
            durationSeconds: 5,
          },
          {
            index: 2,
            description: "使用场景展示，增强代入感",
            voiceoverText: "不管是日常使用还是出门携带，都特别方便。现在下单还有限时优惠，千万别错过！",
            imagePrompt: `Lifestyle photo of ${title} in modern home setting, warm natural light, cozy atmosphere, 1080x1920 portrait`,
            videoPrompt: `Person using ${title} in daily life scene, natural movement, warm lighting, lifestyle feel`,
            durationSeconds: 5,
          },
        ],
        voiceover: `今天给大家带来这款超值的${title}，性价比真的太高了！看这个做工，细节处理得特别好，用起来非常方便。不管是日常使用还是出门携带，都特别方便。现在下单还有限时优惠，千万别错过！`,
        hashtags: ["#好物推荐", "#电商好货", "#爆款"],
      };
    },
  };
}

function mockImageProvider(): ImageProvider {
  return {
    name: "mock-jimeng",
    async generate(): Promise<ImageGenerationResult> {
      await new Promise((r) => setTimeout(r, 600));
      return {
        url: "https://placehold.co/1080x1920/1A1A1F/FFFFFF?text=AI+Generated+Image",
        thumbnailUrl: "https://placehold.co/360x640/1A1A1F/FFFFFF?text=AI+Image",
        provider: "mock-jimeng",
        metadata: { model: "mock", seed: 42 },
      };
    },
  };
}

function mockVideoProvider(): VideoProvider {
  return {
    name: "mock-jimeng",
    async generate(): Promise<VideoGenerationResult> {
      await new Promise((r) => setTimeout(r, 1000));
      return {
        url: "",
        thumbnailUrl: "https://placehold.co/1080x1920/1A1A1F/FFFFFF?text=AI+Generated+Video",
        durationSeconds: 5,
        provider: "mock-jimeng",
        metadata: { model: "mock", seed: 42 },
      };
    },
  };
}

function mockAudioProvider(): AudioProvider {
  return {
    name: "mock-tts",
    async generate(): Promise<AudioGenerationResult> {
      await new Promise((r) => setTimeout(r, 500));
      return {
        url: "",
        durationSeconds: 15,
        provider: "mock-tts",
      };
    },
  };
}

export const claudeProvider: ScriptProvider =
  env.CLAUDE_API_KEY ? createClaudeAdapter(env.CLAUDE_API_KEY) : mockScriptProvider();

export const imageProvider: ImageProvider =
  env.JIMENG_API_KEY ? createJimengImageAdapter({ apiKey: env.JIMENG_API_KEY }) : mockImageProvider();

export const videoProvider: VideoProvider =
  env.JIMENG_API_KEY ? createJimengVideoAdapter({ apiKey: env.JIMENG_API_KEY }) : mockVideoProvider();

export const ttsProvider: AudioProvider =
  env.TTS_API_KEY ? createTTSAdapter({ apiKey: env.TTS_API_KEY }) : mockAudioProvider();

export type {
  ImageProvider,
  VideoProvider,
  AudioProvider,
  ScriptProvider,
  ImageGenerationResult,
  VideoGenerationResult,
  AudioGenerationResult,
  ScriptGenerationResult,
};
