"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { pushPostLoginRoute, submitCredentialsLogin } from "@/lib/credentials-login";

export function LoginForm() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [destination, setDestination] = useState("/dashboard");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function enterApp(href: string) {
    setError("");
    setLoading(true);
    const opened = await pushPostLoginRoute((path) => router.push(path), href);
    if (!opened) setError(t("auth.signedInRetry"));
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSignedIn(false);
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
        setError(t(result.reason === "credentials" ? "auth.errorEmailPassword" : "auth.errorNetwork"));
        return;
      }

      setDestination(result.destination);
      setSignedIn(true);
      const opened = await pushPostLoginRoute((path) => router.push(path), result.destination);
      if (!opened) setError(t("auth.signedInRetry"));
    } catch {
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

      <button
        type={signedIn ? "button" : "submit"}
        disabled={loading}
        onClick={signedIn ? () => void enterApp(destination) : undefined}
        className="inline-flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-brand-900 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-70 transition-colors mt-1 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            {t("auth.loggingIn")}
          </>
        ) : signedIn ? (
          t("auth.enterApp")
        ) : (
          t("auth.loginBtn")
        )}
      </button>

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
