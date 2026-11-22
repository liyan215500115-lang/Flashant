import "server-only";

import type { ImageGenerationInput, ImageGenerationResult, ImageProvider } from "./types";

/** Historical TokenHub default. Production uses TENCENT_MAAS_IMAGE_MODEL when it is set. */
export const DEFAULT_VEGA_IMAGE_MODEL = "wand-vega-image-1.5-pro";

export const DEFAULT_VEGA_LITE_IMAGE_MODEL = "wand-vega-image-lite";

const VEGA_ENV_KEYS = [
  "TENCENT_MAAS_API_KEY",
  "TENCENT_MAAS_BASE_URL",
  "TENCENT_MAAS_IMAGE_MODEL",
  "TENCENT_MAAS_LITE_IMAGE_MODEL",
] as const;

export interface TencentVegaConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * An endpoint is complete when it is an absolute http(s) URL with a host.
 * A bare hostname or an empty scheme is not enough to register the provider.
 */
export function isCompleteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Vega is registered only when the key, both model names, and a complete
 * base URL are all present. Missing any one of them leaves the pack on flux.
 */
export function isTencentVegaConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const key = trimmed(env.TENCENT_MAAS_API_KEY);
  const baseUrl = trimmed(env.TENCENT_MAAS_BASE_URL);
  const model = trimmed(env.TENCENT_MAAS_IMAGE_MODEL);
  const lite = trimmed(env.TENCENT_MAAS_LITE_IMAGE_MODEL);
  return Boolean(key && model && lite && baseUrl && isCompleteHttpUrl(baseUrl));
}

export function tencentVegaEnvKeys(): readonly string[] {
  return VEGA_ENV_KEYS;
}

/**
 * The Vega image model name this process would send.
 * This is a model id, never the API key.
 */
export function configuredVegaImageModel(
  env: Record<string, string | undefined> = process.env,
): string {
  return trimmed(env.TENCENT_MAAS_IMAGE_MODEL) || DEFAULT_VEGA_IMAGE_MODEL;
}

/**
 * Register `vega` and `vega-lite` when the TokenHub settings are complete.
 * Returns false without registering when any required value is missing.
 */
export function registerTencentVegaProviders(
  register: (name: string, provider: ImageProvider) => void,
): boolean {
  if (!isTencentVegaConfigured()) return false;
  const apiKey = process.env.TENCENT_MAAS_API_KEY;
  const baseUrl = process.env.TENCENT_MAAS_BASE_URL;
  register("vega", createTencentVegaProvider({
    apiKey,
    baseUrl,
    model: process.env.TENCENT_MAAS_IMAGE_MODEL,
  }));
  register("vega-lite", createTencentVegaProvider({
    apiKey,
    baseUrl,
    model: process.env.TENCENT_MAAS_LITE_IMAGE_MODEL,
  }));
  return true;
}

/**
 * Join a TokenHub origin, a `/v1` prefix, or a full generations URL
 * onto `POST /v1/wand/vega-images/generations`.
 */
export function vegaGenerationsUrl(baseUrl: string): string {
  const trimmedBase = baseUrl.trim().replace(/\/+$/, "");
  if (trimmedBase.endsWith("/v1/wand/vega-images/generations")) return trimmedBase;
  if (trimmedBase.endsWith("/v1/wand/vega-images")) return `${trimmedBase}/generations`;
  if (trimmedBase.endsWith("/v1")) return `${trimmedBase}/wand/vega-images/generations`;
  return `${trimmedBase}/v1/wand/vega-images/generations`;
}

export function vegaTaskUrl(baseUrl: string, taskId: string): string {
  const generations = vegaGenerationsUrl(baseUrl);
  const root = generations.replace(/\/generations$/, "");
  return `${root}/tasks/${encodeURIComponent(taskId)}`;
}

function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("[redacted]");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringField(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractUrls(data: Record<string, unknown>): string[] {
  const buckets: unknown[] = [];
  if (Array.isArray(data.data)) buckets.push(...data.data);
  if (Array.isArray(data.output)) buckets.push(...data.output);
  if (typeof data.url === "string") buckets.push(data.url);
  const urls: string[] = [];
  for (const item of buckets) {
    if (typeof item === "string" && item.trim()) {
      urls.push(item.trim());
      continue;
    }
    if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
      const url = (item as { url: string }).url.trim();
      if (url) urls.push(url);
    }
  }
  return urls;
}

function toOutputs(predictionId: string, urls: string[]): ImageGenerationResult["outputs"] {
  return urls.map((url, index) => ({
    id: `${predictionId}_${index}`,
    url,
    width: 1024,
    height: 1024,
    fileSize: 0,
    mimeType: "image/png",
  }));
}

/**
 * Reference images for TokenHub: the original product first, then the
 * style-lock image. Vega has one reference list, so both travel as
 * `input[].content[]` entries of type `input_image`.
 */
export function vegaReferenceImages(input: ImageGenerationInput): string[] {
  const images: string[] = [];
  const product = input.productImageUrl?.trim();
  const reference = input.referenceImageUrl?.trim();
  if (product) images.push(product);
  if (reference && reference !== product) images.push(reference);
  return images;
}

export function createTencentVegaProvider(config?: TencentVegaConfig): ImageProvider {
  const apiKey = trimmed(config?.apiKey ?? process.env.TENCENT_MAAS_API_KEY);
  const baseUrl = trimmed(config?.baseUrl ?? process.env.TENCENT_MAAS_BASE_URL);
  const model = trimmed(config?.model ?? process.env.TENCENT_MAAS_IMAGE_MODEL) || DEFAULT_VEGA_IMAGE_MODEL;
  if (!apiKey) throw new Error("TENCENT_MAAS_API_KEY is required");
  if (!baseUrl || !isCompleteHttpUrl(baseUrl)) throw new Error("TENCENT_MAAS_BASE_URL is required");

  const timeoutMs = config?.timeoutMs ?? 45_000;
  const generationsUrl = vegaGenerationsUrl(baseUrl);

  async function readJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    if (!text) return {};
    try {
      return asRecord(JSON.parse(text));
    } catch {
      throw new Error(redact(`Vega API error: ${res.status} ${text.slice(0, 300)}`, apiKey));
    }
  }

  const provider: ImageProvider & { model: string } = {
    name: "tencent-vega",
    model,

    async createPrediction(input: ImageGenerationInput) {
      const images = vegaReferenceImages(input);
      // The model is the one this provider was registered with.
      // Do not honor modelVersion: the single-image flux path fills that
      // with a Replicate model id, and a pack shot must stay on Vega.
      const body: Record<string, unknown> = {
        model,
        prompt: input.prompt,
        size: `${input.width ?? 1024}x${input.height ?? 1024}`,
      };
      if (images.length > 0) {
        body.input = [
          {
            content: images.map((imageUrl) => ({
              type: "input_image",
              image_url: imageUrl,
            })),
          },
        ];
      }

      const res = await fetch(generationsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const data = await readJson(res);
      if (!res.ok) {
        const detail = stringField(data, ["error", "message"]) || JSON.stringify(data);
        throw new Error(redact(`Vega API error: ${res.status} ${detail}`, apiKey).slice(0, 500));
      }

      const taskId = stringField(data, ["task_id", "taskId", "id"]);
      const urls = extractUrls(data);
      if (urls.length > 0) {
        const predictionId = taskId || `vega_${Date.now()}`;
        return {
          predictionId,
          status: "succeeded" as const,
          outputs: toOutputs(predictionId, urls),
          webhookId: taskId || undefined,
        };
      }
      if (!taskId) throw new Error("Vega API error: missing task_id");
      return {
        predictionId: taskId,
        status: "processing" as const,
        webhookId: taskId,
      };
    },

    async getPrediction(predictionId: string): Promise<ImageGenerationResult> {
      const res = await fetch(vegaTaskUrl(baseUrl, predictionId), {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      const data = await readJson(res);
      if (!res.ok) {
        const detail = stringField(data, ["error", "message"]) || JSON.stringify(data);
        throw new Error(redact(`Vega API error: ${res.status} ${detail}`, apiKey).slice(0, 500));
      }

      const status = stringField(data, ["status"]).toLowerCase();
      const urls = extractUrls(data);
      if (status === "completed" || status === "succeeded" || status === "success") {
        if (urls.length === 0) return { outputs: [], status: "failed", error: "no_output" };
        return { outputs: toOutputs(predictionId, urls), status: "succeeded" };
      }
      if (status === "failed" || status === "cancelled" || status === "canceled" || status === "incomplete") {
        const reason = stringField(data, ["error", "message", "failure_reason"]) || `vega_${status}`;
        return {
          outputs: [],
          status: "failed",
          error: redact(reason, apiKey),
        };
      }
      // queued / in_progress / unknown: the pack keeps polling until packDeadline.
      return { outputs: [], status: "processing" };
    },

    async isReady(predictionId: string): Promise<boolean> {
      const result = await this.getPrediction(predictionId);
      return result.status === "succeeded";
    },
  };
  return provider;
}
