import {
  ephemeralProviderUrlExpired,
  ownedStorageKeyFromReference,
  signedUrlExpired,
} from "@/lib/generated-image-display";

const LOCAL_PUBLIC = /^\/(?:uploads|generated|products)\//i;

export interface PublishImageRef {
  id?: string;
  url?: string | null;
  s3Key?: string | null;
  createdAt?: string | null;
}

/**
 * A URL Shopify can fetch, an owned object that still needs a signed GET,
 * or nothing. Expired provider links and bare storage keys are not src values.
 */
export type PublishImageSource =
  | { kind: "url"; url: string }
  | { kind: "owned"; key: string }
  | { kind: "unavailable"; reason: "expired" | "missing" };

function httpBase(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, "");
}

function localPublicPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return LOCAL_PUBLIC.test(trimmed) ? trimmed : null;
}

function remoteUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * Decide what the publish API may hand to Shopify.
 * An owned `generated/` or `products/` object uses the public bucket base when
 * one is configured. Otherwise the caller signs that same object; the
 * auth-gated `/api/generated-images/:id/file` route is for the logged-in page,
 * not for Shopify. Expired provider URLs are not publishable.
 */
export function resolvePublishImageSource(
  image: PublishImageRef,
  options: { origin: string; publicBaseUrl?: string | null; now?: number },
): PublishImageSource {
  const now = options.now ?? Date.now();
  const key = ownedStorageKeyFromReference(image.s3Key) ?? ownedStorageKeyFromReference(image.url);
  if (key) {
    const base = httpBase(options.publicBaseUrl);
    if (base) return { kind: "url", url: `${base}/${key}` };
    return { kind: "owned", key };
  }

  const local = localPublicPath(image.url) ?? localPublicPath(image.s3Key);
  if (local) {
    try {
      return { kind: "url", url: new URL(local, options.origin).href };
    } catch {
      return { kind: "unavailable", reason: "missing" };
    }
  }

  const remote = remoteUrl(image.url) ?? remoteUrl(image.s3Key);
  if (!remote) return { kind: "unavailable", reason: "missing" };
  if (signedUrlExpired(remote, now) || ephemeralProviderUrlExpired(remote, image.createdAt, now)) {
    return { kind: "unavailable", reason: "expired" };
  }
  return { kind: "url", url: remote };
}
