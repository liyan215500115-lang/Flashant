/**
 * Auth.js v5 reads AUTH_URL, then NEXTAUTH_URL, and rewrites the request onto
 * that origin. On Vercel a deployment host (*.vercel.app) must not win over
 * the custom domain the browser is using, or the callback sends the user away
 * from flashant.cn.
 */

const DEPLOYMENT_HOST = ".vercel.app";

export interface AuthUrlEnv {
  AUTH_URL?: string;
  NEXTAUTH_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  [key: string]: string | undefined;
}

export function isDeploymentHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  return host === "vercel.app" || host.endsWith(DEPLOYMENT_HOST);
}

/** Origin only. Credentials, paths, and unparseable values are dropped. */
export function httpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isDeploymentOrigin(value: string | null | undefined): boolean {
  const origin = httpOrigin(value);
  if (!origin) return false;
  return isDeploymentHost(new URL(origin).hostname);
}

/**
 * A non-deployment origin Auth.js may use.
 * AUTH_URL wins, then NEXTAUTH_URL, then the public app URL.
 * A *.vercel.app value is not a choice.
 */
export function resolveAuthBaseUrl(env: AuthUrlEnv): string | null {
  const candidates = [env.AUTH_URL, env.NEXTAUTH_URL, env.NEXT_PUBLIC_APP_URL];
  for (const candidate of candidates) {
    const origin = httpOrigin(candidate);
    if (origin && !isDeploymentOrigin(origin)) return origin;
  }
  return null;
}

/**
 * Drop deployment-host auth URLs so they cannot rewrite a custom-domain request.
 * When a public custom origin is configured and no auth URL remains, point
 * AUTH_URL at it. Never writes a *.vercel.app origin.
 */
export function applyAuthBaseUrl(env: AuthUrlEnv): string | null {
  if (isDeploymentOrigin(env.AUTH_URL)) delete env.AUTH_URL;
  if (isDeploymentOrigin(env.NEXTAUTH_URL)) delete env.NEXTAUTH_URL;
  const chosen = resolveAuthBaseUrl(env);
  if (!env.AUTH_URL && !env.NEXTAUTH_URL && chosen) {
    env.AUTH_URL = chosen;
  }
  return resolveAuthBaseUrl(env);
}

function firstHeader(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  return first || null;
}

/** Browser-facing origin. A custom forwarded host beats a deployment URL. */
export function publicOriginFromHeaders(
  headers: { get(name: string): string | null },
  requestUrl?: string | null,
): string | null {
  const forwarded = firstHeader(headers.get("x-forwarded-host"));
  const host = firstHeader(headers.get("host"));
  const protoHeader = firstHeader(headers.get("x-forwarded-proto"))?.replace(/:$/, "") ?? "";
  const candidate = forwarded || host;
  if (candidate) {
    const hostname = candidate.replace(/:\d+$/, "");
    const proto = protoHeader || (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https");
    const origin = httpOrigin(`${proto}://${candidate}`);
    if (origin && !isDeploymentOrigin(origin)) return origin;
  }
  const fromRequest = httpOrigin(requestUrl);
  if (fromRequest && !isDeploymentOrigin(fromRequest)) return fromRequest;
  if (candidate) {
    const proto = protoHeader || "https";
    return httpOrigin(`${proto}://${candidate}`);
  }
  return fromRequest;
}

/**
 * Origin for this auth request.
 * The host the browser used wins when it is not a Vercel deployment host.
 * Otherwise a configured custom origin wins. A deployment host is last.
 */
export function chooseAuthOrigin(input: {
  env?: AuthUrlEnv;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  requestUrl?: string | null;
}): string | null {
  const requestOrigin = publicOriginFromHeaders({
    get(name: string) {
      const key = name.toLowerCase();
      if (key === "x-forwarded-host") return input.forwardedHost ?? null;
      if (key === "x-forwarded-proto") return input.forwardedProto ?? null;
      if (key === "host") return input.host ?? null;
      return null;
    },
  }, input.requestUrl);
  if (requestOrigin && !isDeploymentOrigin(requestOrigin)) return requestOrigin;
  const configured = resolveAuthBaseUrl(input.env ?? {});
  if (configured) return configured;
  return requestOrigin;
}

export function rewriteUrlOrigin(requestUrl: string, origin: string): string {
  const current = new URL(requestUrl);
  const target = new URL(origin);
  current.protocol = target.protocol;
  current.hostname = target.hostname;
  current.port = target.port;
  return current.toString();
}

/** Same-origin callback, and never replace a custom-domain callback with *.vercel.app. */
export function resolveAuthRedirect(url: string, baseUrl: string): string {
  const base = httpOrigin(baseUrl) ?? baseUrl;
  let next = base;
  try {
    if (url.startsWith("/")) {
      next = `${base}${url}`;
    } else if (new URL(url).origin === new URL(base).origin) {
      next = url;
    }
  } catch {
    next = base;
  }
  try {
    const requested = new URL(url, base);
    const chosen = new URL(next, base);
    if (isDeploymentOrigin(chosen.origin) && !isDeploymentOrigin(requested.origin)) {
      return requested.toString();
    }
  } catch {
    // Keep the Auth.js default.
  }
  return next;
}

export function authActionUrl(origin: string, action: "signin" | "callback", provider = "credentials"): string {
  const base = httpOrigin(origin) ?? origin.replace(/\/$/, "");
  return `${base}/api/auth/${action}/${provider}`;
}
