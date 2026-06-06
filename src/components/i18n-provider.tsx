"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";

type Messages = typeof zh;

function resolve(path: string, messages: Record<string, unknown>): string {
  const keys = path.split(".");
  let val: unknown = messages;
  for (const k of keys) {
    if (val && typeof val === "object" && k in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[k];
    } else {
      return path;
    }
  }
  return typeof val === "string" ? val : path;
}

function readCookieLocale(): string {
  if (typeof document === "undefined") return "zh";
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
  return match?.[1] === "en" ? "en" : "zh";
}

const I18nContext = createContext<{ t: (key: string) => string; locale: string }>({
  t: (key: string) => key,
  locale: "zh",
});

function buildT(messages: Messages) {
  return function t(key: string): string {
    return resolve(key, messages as unknown as Record<string, unknown>);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState("zh");

  useEffect(() => {
    setLocale(readCookieLocale());
  }, []);

  const t = useMemo(() => buildT(locale === "zh" ? zh : en), [locale]);

  return (
    <I18nContext.Provider value={{ t, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
