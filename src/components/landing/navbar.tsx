"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Globe, LogOut, LayoutDashboard, Menu, X, Sparkles } from "lucide-react";
import { Logo } from "@/components/landing/logo";

interface NavbarProps {
  user: { id?: string; name?: string | null; email?: string | null; role?: string | null } | null;
  subscription: { planTier: string; status: string } | null;
  locale: string;
  navLabels: {
    features: string;
    styles: string;
    pricing: string;
    signIn: string;
    startFree: string;
    workspace: string;
    settings: string;
    signOut: string;
    currentPlan: string;
  };
}

const PLAN_LABELS_EN: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  BUSINESS: "Business",
  ENTERPRISE: "Enterprise",
};

const PLAN_LABELS_ZH: Record<string, string> = {
  FREE: "免费版",
  PRO: "Pro",
  BUSINESS: "Business",
  ENTERPRISE: "企业版",
};

function getPlanLabel(planTier: string, locale: string): string {
  const labels = locale === "zh" ? PLAN_LABELS_ZH : PLAN_LABELS_EN;
  return labels[planTier] || planTier;
}

function getCookieLocale(): string {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
  return match?.[1] || "en";
}

export function Navbar({ user, subscription, locale, navLabels }: NavbarProps) {
  const [lang, setLang] = useState(locale || getCookieLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  function toggleLang() {
    const next = lang === "zh" ? "en" : "zh";
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  }

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-zinc-100">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
        {/* Left: brand */}
        <Link href="/" className="flex-shrink-0">
          <Logo size={28} />
        </Link>

        {/* Center: nav links (desktop) */}
        <nav className="hidden md:flex items-center gap-6">
          <a
            href="#features"
            className="text-sm font-medium text-zinc-500 hover:text-brand-900 transition-colors"
          >
            {navLabels.features}
          </a>
          <a
            href="#styles"
            className="text-sm font-medium text-zinc-500 hover:text-brand-900 transition-colors"
          >
            {navLabels.styles}
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-zinc-500 hover:text-brand-900 transition-colors"
          >
            {navLabels.pricing}
          </a>
        </nav>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          {/* Language switcher */}
          <button
            onClick={toggleLang}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-400 hover:text-brand-900 hover:bg-brand-50 transition-colors"
          >
            <Globe size={13} />
            {lang === "en" ? "中文" : "EN"}
          </button>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-900 text-white text-xs font-medium">
                  {user.name?.charAt(0) || "U"}
                </span>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700 max-w-[100px] truncate">
                    {user.name || user.email || "用户"}
                  </span>
                  {subscription && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
                      {getPlanLabel(subscription.planTier, lang)}
                    </span>
                  )}
                </div>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-zinc-200/60 py-1 z-20">
                    <div className="px-3 py-2 border-b border-zinc-100">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {user.name || "用户"}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      {subscription && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {navLabels.currentPlan}：{getPlanLabel(subscription.planTier, lang)}
                        </p>
                      )}
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <LayoutDashboard size={15} />
                      {navLabels.workspace}
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <Globe size={15} />
                      {navLabels.settings}
                    </Link>
                    <div className="border-t border-zinc-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          signOut({ callbackUrl: "/" });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 transition-colors"
                      >
                        <LogOut size={15} />
                        {navLabels.signOut}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-500 hover:text-brand-900 transition-colors px-3 py-1.5"
              >
                {navLabels.signIn}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-800 transition-all shadow-sm shadow-brand-900/10"
              >
                <Sparkles size={13} className="text-holo-400" />
                {navLabels.startFree}
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:bg-zinc-50"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-100 bg-white px-6 py-4 flex flex-col gap-3">
          <a
            href="#features"
            onClick={() => setMobileOpen(false)}
            className="text-sm font-medium text-zinc-500 hover:text-brand-900 transition-colors"
          >
            {navLabels.features}
          </a>
          <a
            href="#styles"
            onClick={() => setMobileOpen(false)}
            className="text-sm font-medium text-zinc-500 hover:text-brand-900 transition-colors"
          >
            {navLabels.styles}
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileOpen(false)}
            className="text-sm font-medium text-zinc-500 hover:text-brand-900 transition-colors"
          >
            {navLabels.pricing}
          </a>
          {!user && (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 transition-all"
            >
              <Sparkles size={13} className="text-holo-400" />
              {navLabels.startFree}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
