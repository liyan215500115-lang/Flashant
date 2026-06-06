"use client";

import { useState } from "react";
import { Loader2, Mail, ArrowRight } from "lucide-react";
import { useT } from "@/components/i18n-provider";

export function ForgotPasswordForm() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
        if (data.resetUrl) setResetUrl(data.resetUrl);
      } else {
        setError(data.error || t("auth.forgotError"));
      }
    } catch {
      setError(t("auth.forgotError"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <Mail size={22} className="text-green-600" />
        </div>
        <p className="text-sm font-medium text-zinc-800">{t("auth.forgotSent")}</p>
        <p className="text-xs text-zinc-500">{t("auth.forgotSentDesc")}</p>
        {resetUrl && (
          <a
            href={resetUrl}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900 transition-colors mt-1"
          >
            {t("auth.goReset")} <ArrowRight size={12} />
          </a>
        )}
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

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-brand-900 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-70 transition-colors mt-1 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            {t("auth.sending")}
          </>
        ) : (
          t("auth.sendReset")
        )}
      </button>
    </form>
  );
}
