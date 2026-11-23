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

/**
 * After the session exists, wait this long before telling the user the
 * workbench did not open. A full-page load that is still on /login by then
 * did not finish, and `location.assign` will not throw to say so.
 */
export const POST_LOGIN_STUCK_MS = 4_000;

export type CredentialsLoginResult =
  | { ok: true; destination: string }
  | { ok: false; reason: "credentials" | "network" };

export type PostLoginNavigation = {
  href: string;
  assigned: boolean;
  cancel: () => void;
};

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

/**
 * Enter the workbench with a full document load on the page's own host.
 *
 * `router.push` often resolves before the destination document finishes, and
 * it does not throw when that later load fails. The login page then stays
 * put with no recovery. Assigning a relative path either loads the workbench
 * on the current host (https://flashant.cn stays on flashant.cn) or leaves
 * this document in place. If it is still here after `POST_LOGIN_STUCK_MS`,
 * `onStuck` runs so the page can show 「进入工作台」 again. The assigned URL
 * is never absolute and never a *.vercel.app host.
 */
export function startPostLoginNavigation(
  href: string,
  options?: {
    origin?: string;
    assign?: (url: string) => void;
    stuckMs?: number;
    onStuck?: () => void;
  },
): PostLoginNavigation {
  const origin = options?.origin ?? readPageOrigin();
  const path = postLoginAssignPath(href, origin);
  const assign = options?.assign ?? assignPage;
  try {
    assign(path);
  } catch {
    return { href: path, assigned: false, cancel() {} };
  }

  const onStuck = options?.onStuck;
  const stuckMs = options?.stuckMs ?? POST_LOGIN_STUCK_MS;
  if (!onStuck || stuckMs < 0) {
    return { href: path, assigned: true, cancel() {} };
  }
  const timer = setTimeout(onStuck, stuckMs);
  return {
    href: path,
    assigned: true,
    cancel() {
      clearTimeout(timer);
    },
  };
}

export async function probeActiveSession(input?: {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  return hasActiveSession(
    input?.fetchImpl ?? fetch,
    input?.timeoutMs ?? LOGIN_SESSION_PROBE_TIMEOUT_MS,
  );
}

function readPageOrigin(): string {
  if (typeof window === "undefined") return "http://localhost";
  try {
    return window.location.origin || "http://localhost";
  } catch {
    return "http://localhost";
  }
}

function assignPage(url: string) {
  window.location.assign(url);
}

/** Relative path on the current host. Unsafe targets become the workbench. */
function postLoginAssignPath(href: string, origin: string): string {
  const path = safePostLoginPath(href, { origin });
  return isAssignableAppPath(path) ? path : DEFAULT_DESTINATION;
}

function isAssignableAppPath(href: string): boolean {
  if (!isAppPath(href)) return false;
  if (href.includes("\\") || href.toLowerCase().includes("vercel.app")) return false;
  const pathname = href.split(/[?#]/)[0] ?? href;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  if (pathname.startsWith("/api/auth")) return false;
  return true;
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
