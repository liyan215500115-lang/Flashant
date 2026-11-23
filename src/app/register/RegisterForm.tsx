"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { startPostLoginNavigation, submitCredentialsLogin } from "@/lib/credentials-login";

export function RegisterForm() {
  const { t } = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [destination, setDestination] = useState("/dashboard");
  const [loading, setLoading] = useState(false);
  const cancelNav = useRef<(() => void) | null>(null);
  const router = useRouter();

  const enterApp = useCallback((href: string) => {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signedIn) {
      enterApp(destination);
      return;
    }
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.errorPasswordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.errorWeakPassword"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "email already registered") {
          setError(t("auth.errorEmailExists"));
        } else {
          setError(t("auth.errorRegisterFailed"));
        }
        return;
      }

      const result = await submitCredentialsLogin({
        email,
        password,
        callbackUrl: "/dashboard",
        origin: window.location.origin,
      });

      if (!result.ok) {
        if (result.reason === "credentials") {
          router.push("/login?registered=1");
        } else {
          setError(t("auth.errorNetwork"));
        }
        return;
      }

      enterApp(result.destination);
    } catch {
      setError(t("auth.errorRegisterFailed"));
    } finally {
      setLoading(false);
    }
  }

  const alertText = error || (signedIn ? t("auth.signedInEntering") : "");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <label htmlFor="name" className="block mb-1.5 text-sm font-medium text-zinc-700">
          {t("auth.name")}
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("auth.namePlaceholder")}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 transition-colors"
        />
      </div>

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
          placeholder={t("auth.passwordPlaceholder")}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block mb-1.5 text-sm font-medium text-zinc-700">
          {t("auth.confirmPassword")}
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
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
              {t("auth.registering")}
            </>
          ) : (
            t("auth.registerBtn")
          )}
        </button>
      )}
    </form>
  );
}
