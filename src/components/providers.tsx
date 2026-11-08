"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import type { JsonMessage } from "@/lib/translate";

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: JsonMessage;
}) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
