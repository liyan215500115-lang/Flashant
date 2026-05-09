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
  ProductAnalysis,
} from "./types";

function mockScriptProvider(): ScriptProvider {
  return {
    name: "mock-claude",
    async analyzeImage(_imageUrl: string, hint?: string): Promise<ProductAnalysis> {
      await new Promise((r) => setTimeout(r, 600));
      const name = hint || "精选商品";
      return {
        name,
        category: "日用百货",
        features: ["高品质材质", "精致做工", "性价比高", "使用便捷"],
        sellingPoints: ["限时优惠", "爆款热卖", "口碑好评"],
        usageScenario: "日常居家使用，办公室也适用",
        targetAudience: "20-40岁注重生活品质的消费者",
        fullDescription: `${name}是一款品质出众的日用产品。采用优质材料，做工精细，设计人性化，非常适合日常使用。无论是自用还是送礼都是很好的选择。`,
      };
    },
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
    async generate(prompt: string, referenceImageUrl?: string): Promise<ImageGenerationResult> {
      await new Promise((r) => setTimeout(r, 600));
      // Mock: return the product image with a scene-specific seed for visual distinction
      // Real mode: Jimeng/Kling API generates actual product scene images
      const base = referenceImageUrl || `https://placehold.co/1080x1920/1A1D23/F8F9FA?text=${encodeURIComponent("上传商品图片")}`;
      const seed = Math.random().toString(36).slice(2, 8);
      return {
        url: `${base}${base.includes("?") ? "&" : "?"}scene=${seed}`,
        thumbnailUrl: `${base}${base.includes("?") ? "&" : "?"}thumb=${seed}`,
        provider: "mock-jimeng",
        metadata: { model: "mock", prompt: prompt.slice(0, 100) },
      };
    },
  };
}

let videoSeed = 0;

function mockVideoProvider(): VideoProvider {
  return {
    name: "mock-jimeng",
    async generate(prompt: string, startImageUrl: string): Promise<VideoGenerationResult> {
      await new Promise((r) => setTimeout(r, 1000));
      videoSeed++;
      return {
        url: startImageUrl, // mock: use image as video placeholder
        thumbnailUrl: startImageUrl,
        durationSeconds: 5,
        provider: "mock-jimeng",
        metadata: { model: "mock", seed: videoSeed, prompt: prompt.slice(0, 80) },
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
