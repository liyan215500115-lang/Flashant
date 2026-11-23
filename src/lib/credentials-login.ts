/**
 * Credential submit that stays on the login page until Auth.js accepts it.
 *
 * `signIn(..., { redirect: false })` from next-auth/react still assigns
 * `window.location` when GET /api/auth/providers fails, then returns undefined.
 * The form treated that as success, so the button returned to "登录" with an
 * empty alert and no POST /api/auth/callback/credentials. A dropped request
 * can only be reported from the client; this helper aborts it and surfaces
 * the failure. It never sends the browser to /api/auth/signin/credentials.
 */

export const CREDENTIALS_CSRF_PATH = "/api/auth/csrf";
export const CREDENTIALS_CALLBACK_PATH = "/api/auth/callback/credentials";
export const SESSION_PATH = "/api/auth/session";

/** Whole csrf + callback attempt. A hung request that never reaches the server ends here. */
export const LOGIN_REQUEST_TIMEOUT_MS = 20_000;
/** After a dropped callback, see whether a session cookie was already stored. */
export const LOGIN_SESSION_PROBE_TIMEOUT_MS = 5_000;

const DEFAULT_DESTINATION = "/dashboard";

export type CredentialsLoginResult =
  | { ok: true; destination: string }
  | { ok: false; reason: "credentials" | "network" };

export function safePostLoginPath(
  value: string | null | undefined,
  options?: { fallback?: string; origin?: string },
): string {
  const fallback = options?.fallback ?? DEFAULT_DESTINATION;
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.includes("\\")) return fallback;

  const origin = options?.origin ?? "http://localhost";
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return fallback;
  }

  try {
    const url = new URL(trimmed, base);
    if (url.origin !== base.origin) return fallback;
    if (url.username || url.password) return fallback;
    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return fallback;
    if (url.pathname.startsWith("/api/auth")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export async function pushPostLoginRoute(
  push: (href: string) => void | Promise<unknown>,
  href: string,
): Promise<boolean> {
  if (!isAppPath(href)) return false;
  try {
    await push(href);
    return true;
  } catch {
    return false;
  }
}

export async function submitCredentialsLogin(input: {
  email: string;
  password: string;
  callbackUrl?: string | null;
  origin?: string;
  timeoutMs?: number;
  sessionProbeTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<CredentialsLoginResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const destination = safePostLoginPath(input.callbackUrl, { origin: input.origin });
  const timeoutMs = input.timeoutMs ?? LOGIN_REQUEST_TIMEOUT_MS;
  const probeTimeoutMs = input.sessionProbeTimeoutMs ?? LOGIN_SESSION_PROBE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const recover = async (): Promise<CredentialsLoginResult> => {
    if (await hasActiveSession(fetchImpl, probeTimeoutMs)) {
      return { ok: true, destination };
    }
    return { ok: false, reason: "network" };
  };

  try {
    const csrfToken = await readCsrfToken(fetchImpl, controller.signal);
    if (!csrfToken) return recover();

    const outcome = await postCredentials(fetchImpl, controller.signal, {
      email: input.email,
      password: input.password,
      csrfToken,
      callbackUrl: destination,
    });
    if (outcome === "success") return { ok: true, destination };
    if (outcome === "credentials") return { ok: false, reason: "credentials" };
    return recover();
  } catch {
    return recover();
  } finally {
    clearTimeout(timer);
  }
}

function isAppPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
}

async function readCsrfToken(fetchImpl: typeof fetch, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetchImpl(CREDENTIALS_CSRF_PATH, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("csrfToken" in data)) return null;
    const token = (data as { csrfToken?: unknown }).csrfToken;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

type CallbackOutcome = "success" | "credentials" | "network";

async function postCredentials(
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  body: { email: string; password: string; csrfToken: string; callbackUrl: string },
): Promise<CallbackOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(CREDENTIALS_CALLBACK_PATH, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams(body),
      signal,
    });
  } catch {
    return "network";
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return "network";
  }

  const error = callbackError(data);
  if (error === "CredentialsSignin") return "credentials";
  if (error) return "network";
  if (response.ok && error === null) return "success";
  return "network";
}

/** null: url present and no error. undefined: body is not a callback redirect. */
function callbackError(data: unknown): string | null | undefined {
  if (!data || typeof data !== "object" || !("url" in data)) return undefined;
  const url = (data as { url?: unknown }).url;
  if (typeof url !== "string" || url.length === 0) return undefined;
  try {
    return new URL(url, "http://localhost").searchParams.get("error");
  } catch {
    return undefined;
  }
}

function abortAfter(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function hasActiveSession(fetchImpl: typeof fetch, timeoutMs: number): Promise<boolean> {
  const timeout = abortAfter(timeoutMs);
  try {
    const response = await fetchImpl(SESSION_PATH, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: timeout.signal,
    });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("user" in data)) return false;
    const user = (data as { user?: unknown }).user;
    if (!user || typeof user !== "object") return false;
    const record = user as { id?: unknown; email?: unknown };
    return (
      (typeof record.email === "string" && record.email.length > 0) ||
      (typeof record.id === "string" && record.id.length > 0)
    );
  } catch {
    return false;
  } finally {
    timeout.cancel();
  }
}
