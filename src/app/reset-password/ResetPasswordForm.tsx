"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/i18n-provider";

export function ResetPasswordForm() {
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("auth.errorWeakPassword"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.errorPasswordMismatch"));
      return;
    }
    if (!token) {
      setError(t("auth.resetInvalidToken"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(data.error || t("auth.resetError"));
      }
    } catch {
      setError(t("auth.resetError"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 text-center">
        {t("auth.resetInvalidToken")}
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <p className="text-sm font-medium text-zinc-800">{t("auth.resetSuccess")}</p>
        <p className="text-xs text-zinc-500">{t("auth.resetSuccessDesc")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block mb-1.5 text-sm font-medium text-zinc-700">
          {t("auth.resetNewPassword")}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block mb-1.5 text-sm font-medium text-zinc-700">
          {t("auth.confirmPassword")}
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-brand-900 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-70 transition-colors mt-1 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            {t("auth.resetting")}
          </>
        ) : (
          t("auth.resetBtn")
        )}
      </button>
    </form>
  );
}
