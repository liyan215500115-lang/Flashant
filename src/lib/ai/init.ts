import "server-only";

import { registerProvider } from "./registry";
import { createReplicateProvider } from "./replicate";
import { createOpenAIProvider } from "./openai";

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  if (process.env.REPLICATE_API_KEY) {
    try {
      const fluxProvider = createReplicateProvider();
      registerProvider("flux", fluxProvider);
      registerProvider("flux2", fluxProvider);
      registerProvider("sdxl", createReplicateProvider({ modelVersion: "stability-ai/sdxl" }));
      registerProvider("playground", createReplicateProvider({ modelVersion: "playgroundai/playground-v2.5-1024px-aesthetic" }));
    } catch {
      // Provider not available — skip registration
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      registerProvider("openai", createOpenAIProvider());
    } catch {
      // Provider not available — skip registration
    }
  }
}
