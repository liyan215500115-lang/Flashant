import "server-only";

import { registerProvider } from "./registry";
import { createReplicateProvider } from "./replicate";
import { createOpenAIProvider } from "./openai";
import { createGeminiProvider } from "./gemini";

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  if (process.env.REPLICATE_API_KEY) {
    try {
      const fluxProvider = createReplicateProvider();
      registerProvider("flux", fluxProvider);
      registerProvider("flux2", fluxProvider);
      // SDXL / Playground — disabled until model version is verified
      // registerProvider("sdxl", createReplicateProvider({ modelVersion: "stability-ai/sdxl" }));
      // registerProvider("playground", createReplicateProvider({ modelVersion: "playgroundai/playground-v2.5-1024px-aesthetic" }));
    } catch {
      // Provider not available — skip registration
    }
  }

  // All image models via laozhang.ai
  if (process.env.NANO_BANANA_API_KEY) {
    try {
      // seedream-4-0: ~6s, supports img2img (image param) — best for product consistency
      registerProvider("gemini", createGeminiProvider({ model: "seedream-4-0-250828" }));
      // gpt-image-2: ~47s, no img2img support
      registerProvider("gpt-image", createGeminiProvider({ model: "gpt-image-2", timeoutMs: 120_000 }));
    } catch {}
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      registerProvider("openai", createOpenAIProvider());
    } catch {
      // Provider not available — skip registration
    }
  }
}
