"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import {
  probeActiveSession,
  safePostLoginPath,
  startPostLoginNavigation,
  submitCredentialsLogin,
} from "@/lib/credentials-login";

export function LoginForm() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [destination, setDestination] = useState("/dashboard");
  const [loading, setLoading] = useState(false);
  const cancelNav = useRef<(() => void) | null>(null);
  const suppressAutoEnter = useRef(false);
  const entryStarted = useRef(false);

  const enterApp = useCallback((href: string) => {
    entryStarted.current = true;
    cancelNav.current?.();
    const nav = startPostLoginNavigation(href, {
      origin: window.location.origin,
      onStuck: () => setError(t("auth.signedInRetry")),
    });
    cancelNav.current = nav.cancel;
    setDestination(nav.href);
    setSignedIn(true);
    setLoading(false);
    setError(nav.assigned ? "" : t("auth.signedInRetry"));
  }, [t]);

  useEffect(() => () => cancelNav.current?.(), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const href = safePostLoginPath(params.get("callbackUrl"), { origin: window.location.origin });
    let cancelled = false;
    probeActiveSession()
      .then((active) => {
        if (cancelled || !active || suppressAutoEnter.current || entryStarted.current) return;
        // Already signed in. Show the entry control and wait for a click.
        // Assigning here would loop when a workbench load sends the user back.
        setDestination(href);
        setSignedIn(true);
        setError(t("auth.signedInRetry"));
      })
      .catch(() => {
        // A failed probe leaves the password form in place.
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signedIn) {
      enterApp(destination);
      return;
    }
    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);
      const result = await submitCredentialsLogin({
        email,
        password,
        callbackUrl: params.get("callbackUrl"),
        origin: window.location.origin,
      });

      if (!result.ok) {
        suppressAutoEnter.current = true;
        cancelNav.current?.();
        setSignedIn(false);
        setError(t(result.reason === "credentials" ? "auth.errorEmailPassword" : "auth.errorNetwork"));
        return;
      }

      enterApp(result.destination);
    } catch {
      suppressAutoEnter.current = true;
      cancelNav.current?.();
      setSignedIn(false);
      setError(t("auth.errorNetwork"));
    } finally {
      setLoading(false);
    }
  }

  const alertText = error || (signedIn ? t("auth.signedInEntering") : "");

  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      {alertText && (
        <div
          role="alert"
          className={
            error
              ? "rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
              : "rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-zinc-700"
          }
        >
          {alertText}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block mb-1.5 text-sm font-medium text-zinc-700">
          {t("auth.email")}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder={t("auth.emailPlaceholder")}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="password" className="block mb-1.5 text-sm font-medium text-zinc-700">
          {t("auth.password")}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder={t("auth.passwordPlaceholder")}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 transition-colors"
        />
      </div>

      {signedIn ? (
        <a
          href={destination}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            enterApp(destination);
          }}
          className="inline-flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-brand-900 text-sm font-medium text-white hover:bg-brand-800 transition-colors mt-1 cursor-pointer"
        >
          {t("auth.enterApp")}
        </a>
      ) : (
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-brand-900 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-70 transition-colors mt-1 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t("auth.loggingIn")}
            </>
          ) : (
            t("auth.loginBtn")
          )}
        </button>
      )}

      <div className="text-right mt-2">
        <a
          href="/forgot-password"
          className="text-xs text-zinc-400 hover:text-brand-700 transition-colors"
        >
          {t("auth.forgotPassword")}
        </a>
      </div>
    </form>
  );
}
