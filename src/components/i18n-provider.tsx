"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { resolveLocale } from "@/lib/locales";
import { translate, type JsonMessage } from "@/lib/translate";

const I18nContext = createContext<{ t: (key: string) => string; locale: string }>({
  t: (key: string) => key,
  locale: "en",
});

export function I18nProvider({
  locale = "en",
  messages,
  children,
}: {
  locale?: string;
  messages: JsonMessage;
  children: ReactNode;
}) {
  const resolved = resolveLocale(locale);
  const t = useMemo(() => (key: string) => translate(messages, key), [messages]);

  return (
    <I18nContext.Provider value={{ t, locale: resolved }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
