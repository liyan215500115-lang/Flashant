import { generatedImageFilePath, isOwnedStorageKey } from "@/lib/stored-image";

/**
 * Historical generations often stored the provider URL in both `url` and `s3Key`
 * when the copy into our bucket failed or predated that copy. Replicate delivery
 * links and signed COS / Azure links expire, so a SUCCEEDED row can still have
 * nothing to paint. A key we uploaded (`generated/…` or `products/…`), including
 * one embedded in our own public URL, is served from the same-origin file route.
 */

export interface GeneratedShotRef {
  id: string;
  status: string;
  url?: string | null;
  s3Key?: string | null;
  createdAt?: string | null;
}

export interface ShotDisplay {
  id: string;
  /** Null when no recoverable bytes remain. */
  src: string | null;
  /** True when src is a file we stored, not a provider link that can expire. */
  durable: boolean;
}

export interface CompletionBanner {
  kind: "complete" | "unavailable" | "partial" | "failed" | "pending" | "none";
  ready: number;
  unavailable: number;
  failed: number;
  pending: number;
}

const LOCAL_PUBLIC = /^\/(?:uploads|generated|products)\//i;
const EPHEMERAL_HOST = /(^|\.)replicate\.delivery$|(^|\.)replicate\.com$|(^|\.)bfl\.ai$|(^|\.)blob\.core\.windows\.net$/i;
/** Provider links we did not copy are not trusted after this age. */
const EPHEMERAL_MAX_AGE_MS = 60 * 60 * 1000;

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template,
  );
}

/** Bucket key we can stream. A site-relative `/generated/` path is a local file, not this. */
export function ownedStorageKeyFromReference(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isOwnedStorageKey(trimmed) && !trimmed.startsWith("/")) {
    if (trimmed.startsWith("generated/") || trimmed.startsWith("products/")) return trimmed;
    return null;
  }
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const path = decodeURIComponent(new URL(trimmed).pathname).replace(/^\/+/, "");
    const match = path.match(/(?:^|\/)((?:generated|products)\/[^/?#]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function signedUrlExpired(value: string | null | undefined, now = Date.now()): boolean {
  const trimmed = value?.trim() ?? "";
  if (!/^https?:\/\//i.test(trimmed)) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }

  const qSign = url.searchParams.get("q-sign-time");
  if (qSign) {
    const end = Number(qSign.split(";")[1]);
    if (Number.isFinite(end) && end > 0 && end * 1000 <= now) return true;
  }

  const amzDate = url.searchParams.get("X-Amz-Date");
  const amzExpires = url.searchParams.get("X-Amz-Expires");
  if (amzDate && amzExpires) {
    const match = amzDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    const seconds = Number(amzExpires);
    if (match && Number.isFinite(seconds)) {
      const start = Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6]),
      );
      if (start + seconds * 1000 <= now) return true;
    }
  }

  const expires = url.searchParams.get("Expires");
  if (expires && /^\d{9,}$/.test(expires)) {
    const end = Number(expires);
    if (Number.isFinite(end) && end * 1000 <= now) return true;
  }

  const se = url.searchParams.get("se");
  if (se) {
    const end = Date.parse(se);
    if (Number.isFinite(end) && end <= now) return true;
  }

  return false;
}

function localPublicPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return LOCAL_PUBLIC.test(trimmed) ? trimmed : null;
}

/** A short-lived provider host whose row is already older than the link TTL. */
export function ephemeralProviderUrlExpired(
  value: string | null | undefined,
  createdAt: string | null | undefined,
  now = Date.now(),
): boolean {
  const trimmed = value?.trim() ?? "";
  if (!/^https?:\/\//i.test(trimmed)) return false;
  let hostname = "";
  try {
    hostname = new URL(trimmed).hostname;
  } catch {
    return false;
  }
  if (!EPHEMERAL_HOST.test(hostname)) return false;
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created > EPHEMERAL_MAX_AGE_MS;
}

export function displayForGeneratedImage(image: GeneratedShotRef, now = Date.now()): ShotDisplay {
  const key = ownedStorageKeyFromReference(image.s3Key) ?? ownedStorageKeyFromReference(image.url);
  if (key && image.id) {
    return { id: image.id, src: generatedImageFilePath(image.id), durable: true };
  }

  const local = localPublicPath(image.url) ?? localPublicPath(image.s3Key);
  if (local) return { id: image.id, src: local, durable: true };

  const remote = [image.url, image.s3Key].find((value) => /^https?:\/\//i.test(value?.trim() ?? ""))?.trim() ?? "";
  if (!remote) return { id: image.id, src: null, durable: false };
  if (signedUrlExpired(remote, now) || ephemeralProviderUrlExpired(remote, image.createdAt, now)) {
    return { id: image.id, src: null, durable: false };
  }
  return { id: image.id, src: remote, durable: false };
}

export function downloadableGeneratedSrc(
  image: GeneratedShotRef,
  options?: { loadedIds?: ReadonlySet<string>; brokenIds?: ReadonlySet<string>; now?: number },
): string | null {
  const display = displayForGeneratedImage(image, options?.now);
  if (!display.src) return null;
  if (options?.brokenIds?.has(image.id)) return null;
  if (!display.durable && !options?.loadedIds?.has(image.id)) return null;
  return display.src;
}

export function generationCompletionBanner(input: {
  projectStatus: string;
  images: GeneratedShotRef[];
  loadedIds?: ReadonlySet<string>;
  brokenIds?: ReadonlySet<string>;
  now?: number;
}): CompletionBanner {
  const loaded = input.loadedIds ?? new Set<string>();
  const broken = input.brokenIds ?? new Set<string>();
  const succeeded = input.images.filter((image) => image.status === "SUCCEEDED");
  const failed = input.images.filter((image) => image.status === "FAILED").length;

  let ready = 0;
  let unavailable = 0;
  let pending = 0;
  for (const image of succeeded) {
    const display = displayForGeneratedImage(image, input.now);
    if (broken.has(image.id) || !display.src) {
      unavailable += 1;
      continue;
    }
    if (display.durable || loaded.has(image.id)) {
      ready += 1;
      continue;
    }
    pending += 1;
  }

  const counts = { ready, unavailable, failed, pending };
  if (input.projectStatus !== "GENERATED") return { kind: "none", ...counts };
  if (pending > 0 && failed === 0) return { kind: "pending", ...counts };
  if (failed > 0) return { kind: "failed", ...counts };
  if (ready > 0 && unavailable === 0) return { kind: "complete", ...counts };
  if (ready === 0 && unavailable > 0) return { kind: "unavailable", ...counts };
  if (ready > 0 && unavailable > 0) return { kind: "partial", ...counts };
  return { kind: "none", ...counts };
}

/** The sentence under the grid. Pending and failed rows use other copy. Never claims N images are ready when none can be shown. */
export function generationStatusText(
  banner: CompletionBanner,
  t: (key: string) => string,
): string | null {
  if (banner.kind === "complete") {
    return `${t("detail.allDone")} — ${banner.ready} ${t("detail.imagesReady")}`;
  }
  if (banner.kind === "unavailable") {
    return fillTemplate(t("detail.imagesUnavailable"), { count: banner.unavailable });
  }
  if (banner.kind === "partial") {
    return fillTemplate(t("detail.imagesPartlyUnavailable"), {
      ready: banner.ready,
      unavailable: banner.unavailable,
    });
  }
  return null;
}
