import "server-only";

import type { ImageProvider, ImageGenerationInput, ImageGenerationResult } from "./types";
import { uploadBuffer, hasS3Config } from "@/lib/s3";

interface KontextConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * flux-kontext-pro via laozhang.ai — the ONLY true img2img engine on laozhang
 * (gemini-3.1-flash-image / gpt-image-2 accept the `image` param but silently
 * ignore it and do pure text-to-image; verified by side-by-side output comparison).
 *
 * flux-kontext-pro (Black Forest Labs' image-editing model) genuinely uses the
 * input image. laozhang returns a signed bfl.ai URL that EXPIRES, so we download
 * the image and persist it to R2 inside createPrediction — callers always get a
 * stable R2 URL back. Cost: $0.03/image (flat), cheaper than flux-2-pro img2img
 * (~$0.045 with a 1MP reference) and purpose-built for image editing.
 */
export function createLaozhangKontextProvider(config?: Partial<KontextConfig>): ImageProvider {
  const apiKey = config?.apiKey ?? process.env.NANO_BANANA_API_KEY;
  if (!apiKey) throw new Error("NANO_BANANA_API_KEY is required for kontext provider");
  const baseUrl = "https://api.laozhang.ai/v1";
  const model = config?.model ?? "flux-kontext-pro";
  const timeoutMs = config?.timeoutMs ?? 120_000;

  return {
    name: "kontext",

    async createPrediction(input: ImageGenerationInput) {
      // img2img requires a reference image. Without one, kontext is the wrong tool —
      // caller should route to a text-to-image engine instead.
      if (!input.productImageUrl) {
        return {
          predictionId: `kontext-${Date.now()}`,
          status: "failed",
          error: "flux-kontext-pro requires a reference image (img2img only)",
        };
      }

      const requestBody: Record<string, unknown> = {
        model,
        prompt: input.prompt,
        n: 1,
        size: `${input.width ?? 1024}x${input.height ?? 1024}`,
        image: input.productImageUrl,
      };

      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Kontext API error: ${res.status} ${err}`);
      }

      const data = await res.json();
      const item = data.data?.[0];
      // laozhang returns either a signed bfl.ai URL or b64_json
      const remoteUrl: string | undefined = item?.url;
      const b64: string | undefined = item?.b64_json;

      if (!remoteUrl && !b64) {
        return { predictionId: `kontext-${Date.now()}`, status: "failed", error: "No image returned" };
      }

      // Resolve to a buffer, then persist to R2 so the URL never expires.
      let imageBuf: Buffer;
      if (b64) {
        const raw = b64.startsWith("data:") ? b64.split(",")[1] : b64;
        imageBuf = Buffer.from(raw, "base64");
      } else {
        const r = await fetch(remoteUrl!);
        if (!r.ok) throw new Error(`Failed to download kontext image: ${r.status}`);
        imageBuf = Buffer.from(await r.arrayBuffer());
      }

      const outputs: ImageGenerationResult["outputs"] = [];

      if (hasS3Config()) {
        const r2 = await uploadBuffer(imageBuf, "image/png", "generated/");
        outputs.push({
          id: `kontext-${Date.now()}`,
          url: r2.publicUrl,
          width: input.width ?? 1024,
          height: input.height ?? 1024,
          fileSize: imageBuf.length,
          mimeType: "image/png",
        });
      } else {
        // Without R2 there is nowhere durable to put the image. Fail loudly rather
        // than returning an expiring bfl.ai URL that would rot in the database.
        throw new Error(
          "flux-kontext-pro returned an image but S3/R2 is not configured. " +
            "Set R2/S3 env vars to persist generated images."
        );
      }

      return {
        predictionId: data.id ?? `kontext-${Date.now()}`,
        status: "succeeded",
        outputs,
      };
    },

    async getPrediction(): Promise<ImageGenerationResult> {
      // Synchronous provider — result is already returned by createPrediction.
      return { outputs: [], status: "processing" };
    },

    async isReady(): Promise<boolean> {
      return true;
    },
  };
}
