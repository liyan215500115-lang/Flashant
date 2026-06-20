import "server-only";

import { registerProvider } from "./registry";
import { createReplicateProvider } from "./replicate";
import { createOpenAIProvider } from "./openai";
import { createGeminiProvider } from "./gemini";
import { createLaozhangKontextProvider } from "./laozhang-kontext";

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  // ── Primary img2img engine: flux-kontext-pro via laozhang ──
  // $0.03/image flat, purpose-built for image editing, genuinely uses the input image.
  // Cheaper than flux-2-pro img2img (~$0.045 with a 1MP ref) and the better fit for the
  // core "upload product photo → generate product image" flow.
  let kontextRegistered = false;
  if (process.env.NANO_BANANA_API_KEY) {
    try {
      registerProvider("flux", createLaozhangKontextProvider());
      kontextRegistered = true;
    } catch {
      // Provider construction failed — fall through to flux-2-pro as default "flux"
    }
  }

  // ── Backup img2img engine: flux-2-pro via Replicate ──
  // Bills per input + output megapixel, so always pair with prepareReferenceImage() to
  // compress inputs. Registered under "flux-pro" for direct selection, and ALSO under
  // "flux" when kontext is unavailable (so the app always has a default provider).
  if (process.env.REPLICATE_API_KEY) {
    try {
      const flux2Pro = createReplicateProvider();
      registerProvider("flux-pro", flux2Pro);
      if (!kontextRegistered) {
        registerProvider("flux", flux2Pro);
      }
      // SDXL / Playground — disabled until model version is verified
      // registerProvider("sdxl", createReplicateProvider({ modelVersion: "stability-ai/sdxl" }));
      // registerProvider("playground", createReplicateProvider({ modelVersion: "playgroundai/playground-v2.5-1024px-aesthetic" }));
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
