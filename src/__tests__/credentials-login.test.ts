import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CREDENTIALS_CALLBACK_PATH,
  CREDENTIALS_CSRF_PATH,
  POST_LOGIN_STUCK_MS,
  SESSION_PATH,
  probeActiveSession,
  safePostLoginPath,
  startPostLoginNavigation,
  submitCredentialsLogin,
} from "@/lib/credentials-login";
import { applyAuthBaseUrl, chooseAuthOrigin, resolveAuthRedirect } from "@/lib/auth-base-url";

const custom = "https://flashant.cn";
const deployment = "https://flashant.vercel.app";

type Call = {
  url: string;
  method: string;
  body: string | null;
  redirectHeader: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function hangUntilAbort(signal?: AbortSignal | null): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    signal?.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("credential login client", () => {
  it("shows a network failure when the request times out before the callback", async () => {
    const calls: Call[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(record(input, init));
      if (String(input) === SESSION_PATH) return jsonResponse(null);
      return hangUntilAbort(init?.signal ?? null);
    };

    const result = await submitCredentialsLogin({
      email: "owner@example.com",
      password: "secret",
      callbackUrl: "/dashboard",
      origin: custom,
      timeoutMs: 30,
      sessionProbeTimeoutMs: 20,
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, reason: "network" });
    expect(calls.map((call) => call.url)).toEqual([CREDENTIALS_CSRF_PATH, SESSION_PATH]);
    expect(calls.some((call) => call.url.includes("/api/auth/signin"))).toBe(false);
  });

  it("shows a network failure when csrf or the callback throws, and does not navigate", async () => {
    const href = window.location.href;
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input) === SESSION_PATH) return jsonResponse({});
      throw new TypeError("Failed to fetch");
    };

    const result = await submitCredentialsLogin({
      email: "owner@example.com",
      password: "secret",
      origin: custom,
      timeoutMs: 1_000,
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, reason: "network" });
    expect(window.location.href).toBe(href);
  });

  it("shows a network failure for a non-OK callback body", async () => {
    const fetchImpl = mockFetch({
      csrf: jsonResponse({ csrfToken: "csrf-token" }),
      callback: new Response("<html>bad gateway</html>", { status: 502 }),
      session: jsonResponse(null),
    });

    const result = await submitCredentialsLogin({
      email: "owner@example.com",
      password: "secret",
      origin: custom,
      fetchImpl: fetchImpl.fetch,
    });

    expect(result).toEqual({ ok: false, reason: "network" });
    expect(fetchImpl.calls.map((call) => call.url)).toContain(CREDENTIALS_CALLBACK_PATH);
  });

  it("keeps a wrong password on the login page and does not treat it as a dropped request", async () => {
    const fetchImpl = mockFetch({
      csrf: jsonResponse({ csrfToken: "csrf-token" }),
      callback: jsonResponse({
        url: `${custom}/login?error=CredentialsSignin`,
      }),
      session: jsonResponse({ user: { email: "already@example.com" } }),
    });

    const result = await submitCredentialsLogin({
      email: "owner@example.com",
      password: "wrong",
      origin: custom,
      fetchImpl: fetchImpl.fetch,
    });

    expect(result).toEqual({ ok: false, reason: "credentials" });
    expect(fetchImpl.calls.map((call) => call.url)).not.toContain(SESSION_PATH);
  });

  it("navigates to the callback path after the callback accepts the password", async () => {
    const fetchImpl = mockFetch({
      csrf: jsonResponse({ csrfToken: "csrf-token" }),
      callback: jsonResponse({ url: `${custom}/projects/abc` }),
    });

    const result = await submitCredentialsLogin({
      email: "owner@example.com",
      password: "secret",
      callbackUrl: "/projects/abc",
      origin: custom,
      fetchImpl: fetchImpl.fetch,
    });

    expect(result).toEqual({ ok: true, destination: "/projects/abc" });
    const callback = fetchImpl.calls.find((call) => call.url === CREDENTIALS_CALLBACK_PATH);
    expect(callback?.method).toBe("POST");
    expect(callback?.redirectHeader).toBe("1");
    const body = new URLSearchParams(callback?.body ?? "");
    expect(body.get("callbackUrl")).toBe("/projects/abc");
    expect(body.get("csrfToken")).toBe("csrf-token");
    expect(callback?.url.startsWith("/")).toBe(true);
    expect(callback?.url).not.toContain("vercel.app");
    expect(fetchImpl.calls.every((call) => !call.url.includes("/api/auth/signin"))).toBe(true);
  });

  it("keeps an existing session when the callback response never arrives", async () => {
    const fetchImpl = mockFetch({
      csrf: jsonResponse({ csrfToken: "csrf-token" }),
      callback: hangUntilAbort,
      session: jsonResponse({ user: { id: "user-1", email: "owner@example.com" } }),
    });

    const result = await submitCredentialsLogin({
      email: "owner@example.com",
      password: "secret",
      callbackUrl: "/settings",
      origin: custom,
      timeoutMs: 30,
      sessionProbeTimeoutMs: 20,
      fetchImpl: fetchImpl.fetch,
    });

    expect(result).toEqual({ ok: true, destination: "/settings" });
    expect(fetchImpl.calls.map((call) => call.url)).toEqual([
      CREDENTIALS_CSRF_PATH,
      CREDENTIALS_CALLBACK_PATH,
      SESSION_PATH,
    ]);
  });

  it("does not follow a deployment-host callback url", () => {
    expect(safePostLoginPath(`${deployment}/dashboard`, { origin: custom })).toBe("/dashboard");
    expect(safePostLoginPath(`${custom}/projects/abc`, { origin: custom })).toBe("/projects/abc");
    expect(safePostLoginPath("//evil.example/dashboard", { origin: custom })).toBe("/dashboard");
    expect(safePostLoginPath("/login?callbackUrl=/settings", { origin: custom })).toBe("/dashboard");
    expect(safePostLoginPath("/dashboard", { origin: custom })).toBe("/dashboard");
  });

  it("still ignores a *.vercel.app AUTH_URL and keeps the forwarded custom host", () => {
    const env = {
      AUTH_URL: deployment,
      NEXTAUTH_URL: deployment,
      NEXT_PUBLIC_APP_URL: custom,
    };
    expect(applyAuthBaseUrl(env)).toBe(custom);
    expect(env.AUTH_URL).toBe(custom);
    expect(env.NEXTAUTH_URL).toBeUndefined();
    expect(chooseAuthOrigin({
      env,
      forwardedHost: "www.flashant.cn",
      forwardedProto: "https",
      requestUrl: `${deployment}/api/auth/callback/credentials`,
    })).toBe("https://www.flashant.cn");
    expect(resolveAuthRedirect(`${custom}/dashboard`, deployment)).toBe(`${custom}/dashboard`);
    expect(resolveAuthRedirect(`${custom}/dashboard`, deployment)).not.toContain("vercel.app");
  });

  it("does not change GET /api/auth/signin/credentials", () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return jsonResponse({ csrfToken: "csrf-token" });
    };
    return submitCredentialsLogin({
      email: "owner@example.com",
      password: "secret",
      origin: custom,
      fetchImpl: async (input, init) => {
        if (String(input) === CREDENTIALS_CALLBACK_PATH) {
          calls.push(String(input));
          return jsonResponse({ url: `${custom}/dashboard` });
        }
        return fetchImpl(input, init);
      },
    }).then((result) => {
      expect(result.ok).toBe(true);
      expect(calls).not.toContain("/api/auth/signin/credentials");
      expect(calls.some((url) => url.includes("UnknownAction"))).toBe(false);
    });
  });

  it("reads an existing session only from GET /api/auth/session", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return jsonResponse({ user: { email: "owner@example.com" } });
    };

    await expect(probeActiveSession({ fetchImpl, timeoutMs: 20 })).resolves.toBe(true);
    expect(calls).toEqual([SESSION_PATH]);
    expect(calls.some((url) => url.includes("/api/auth/signin"))).toBe(false);
  });

  it("loads the workbench with location.assign on the current host", () => {
    const assign = vi.fn();
    const previous = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, origin: custom, href: `${custom}/login` },
    });
    try {
      const nav = startPostLoginNavigation("/projects/abc", { stuckMs: -1 });
      expect(nav.assigned).toBe(true);
      expect(nav.href).toBe("/projects/abc");
      expect(assign).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith("/projects/abc");
      expect(String(assign.mock.calls[0][0]).startsWith("/")).toBe(true);
      expect(String(assign.mock.calls[0][0])).not.toContain("vercel.app");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: previous });
    }
  });

  it("assigns a safe relative path and never a deployment host, login page, or auth route", () => {
    const assign = vi.fn();
    const blocked = [
      `${deployment}/dashboard`,
      "https://flashant.vercel.app/projects/abc",
      "//evil.example/dashboard",
      "/login?callbackUrl=/settings",
      "/api/auth/signin/credentials",
      "/api/auth/callback/credentials",
    ];
    for (const href of blocked) {
      assign.mockClear();
      const nav = startPostLoginNavigation(href, { origin: custom, assign, stuckMs: -1 });
      expect(nav.href).toBe("/dashboard");
      expect(assign).toHaveBeenCalledWith("/dashboard");
      const target = String(assign.mock.calls[0][0]);
      expect(target.startsWith("/")).toBe(true);
      expect(target.startsWith("//")).toBe(false);
      expect(target).not.toContain("vercel.app");
      expect(target.startsWith("/login")).toBe(false);
      expect(target.startsWith("/api/auth")).toBe(false);
    }

    assign.mockClear();
    const sameHost = startPostLoginNavigation(`${custom}/projects/abc`, {
      origin: custom,
      assign,
      stuckMs: -1,
    });
    expect(sameHost.href).toBe("/projects/abc");
    expect(assign).toHaveBeenCalledWith("/projects/abc");
  });

  it("keeps the session retryable when the workbench navigation throws or the page stays", () => {
    const thrown = vi.fn(() => {
      throw new Error("dashboard failed to load");
    });
    const failed = startPostLoginNavigation("/projects/abc", { origin: custom, assign: thrown });
    expect(failed.assigned).toBe(false);
    expect(failed.href).toBe("/projects/abc");
    expect(thrown).toHaveBeenCalledWith("/projects/abc");

    vi.useFakeTimers();
    const assign = vi.fn();
    const onStuck = vi.fn();
    const pending = startPostLoginNavigation("/dashboard", {
      origin: custom,
      assign,
      onStuck,
      stuckMs: POST_LOGIN_STUCK_MS,
    });
    expect(pending.assigned).toBe(true);
    expect(onStuck).not.toHaveBeenCalled();
    vi.advanceTimersByTime(POST_LOGIN_STUCK_MS - 1);
    expect(onStuck).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStuck).toHaveBeenCalledTimes(1);

    onStuck.mockClear();
    const cancelled = startPostLoginNavigation("/dashboard", {
      origin: custom,
      assign,
      onStuck,
      stuckMs: POST_LOGIN_STUCK_MS,
    });
    cancelled.cancel();
    vi.advanceTimersByTime(POST_LOGIN_STUCK_MS);
    expect(onStuck).not.toHaveBeenCalled();
  });
});

function record(input: RequestInfo | URL, init?: RequestInit): Call {
  const headers = new Headers(init?.headers);
  const body = init?.body instanceof URLSearchParams ? init.body.toString() : null;
  return {
    url: String(input),
    method: init?.method ?? "GET",
    body,
    redirectHeader: headers.get("X-Auth-Return-Redirect"),
  };
}

function mockFetch(routes: {
  csrf?: Response | ((signal?: AbortSignal | null) => Promise<Response>);
  callback?: Response | ((signal?: AbortSignal | null) => Promise<Response>);
  session?: Response;
}) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push(record(input, init));
    const url = String(input);
    const route =
      url === CREDENTIALS_CSRF_PATH
        ? routes.csrf
        : url === CREDENTIALS_CALLBACK_PATH
          ? routes.callback
          : url === SESSION_PATH
            ? routes.session
            : undefined;
    if (!route) return jsonResponse({ error: "unexpected" }, 500);
    if (typeof route === "function") return route(init?.signal ?? null);
    return route;
  };
  return { fetch: fetchImpl, calls };
}
