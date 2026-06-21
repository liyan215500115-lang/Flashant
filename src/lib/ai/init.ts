import "server-only";

import { registerProvider } from "./registry";
import { createReplicateProvider } from "./replicate";
import { createBriaProvider } from "./bria";
import { createOpenAIProvider } from "./openai";
import { createGeminiProvider } from "./gemini";
import { createLaozhangKontextProvider } from "./laozhang-kontext";

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  // ── Primary img2img engine: flux-2-pro via Replicate ──
  // Replicate direct (no middleman), stable, and stronger at style transfer than kontext.
  // Bills per input + output megapixel (~$0.045/img2img with a 1MP ref), so always pair
  // with prepareReferenceImage() to compress inputs. Registered under "flux" (default) and
  // "flux-pro" (kept for backward compat with old recipe data in users' localStorage).
  if (process.env.REPLICATE_API_KEY) {
    try {
      const flux2Pro = createReplicateProvider();
      registerProvider("flux", flux2Pro);
      registerProvider("flux-pro", flux2Pro);
      // SDXL / Playground — disabled until model version is verified
      // registerProvider("sdxl", createReplicateProvider({ modelVersion: "stability-ai/sdxl" }));
      // registerProvider("playground", createReplicateProvider({ modelVersion: "playgroundai/playground-v2.5-1024px-aesthetic" }));
    } catch {
      // Provider not available — skip registration
    }

    // ── Backup img2img engine: bria/generate-background ──
    // Purpose-built for e-commerce product photography (preserves the product, renders a
    // new background from bg_prompt). Verified good fit for the core flow and likely
    // cheaper than flux-2-pro. Exposed in the UI as a selectable "商品图专用" engine.
    try {
      registerProvider("bria", createBriaProvider());
    } catch {
      // Provider not available — skip registration
    }
  }

  // ── Hidden backup img2img engine: flux-kontext-pro via laozhang ──
  // $0.03/image flat. NOT exposed in the UI — it is weaker at style transfer than flux-2-pro
  // and laozhang's relay has been unstable (intermittent convert_request_failed / 500).
  // Registered under "flux-kontext" so code can reach it as a fallback if Replicate is down,
  // but users never select it directly. Re-evaluate exposing it once laozhang stabilizes.
  if (process.env.NANO_BANANA_API_KEY) {
    try {
      registerProvider("flux-kontext", createLaozhangKontextProvider());
    } catch {
      // Provider not available — skip registration
    }
  }

  // ── Text-to-image only: gpt-image-2 via laozhang ──
  // NOTE: gpt-image-2 and gemini-3.1-flash-image accept the `image` param on laozhang but
  // SILENTLY IGNORE IT — they are pure text-to-image. Only register for users who want
  // text-to-image (no reference upload). gemini-3.1-flash-image was decommissioned
  // ($0.09/image, no img2img, no quality advantage over gpt-image-2 at $0.03).
  if (process.env.NANO_BANANA_API_KEY) {
    try {
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
