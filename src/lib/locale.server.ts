import "server-only";

import { cookies } from "next/headers";
import { resolveLocale, type AppLocale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";
import { translate, type JsonMessage } from "@/lib/translate";

export async function getAppLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get("NEXT_LOCALE")?.value);
}

export async function getTranslator(): Promise<{
  locale: AppLocale;
  messages: JsonMessage;
  t: (key: string) => string;
}> {
  const locale = await getAppLocale();
  const messages = getMessages(locale);
  const t = (key: string) => {
    const value = translate(messages, key);
    return value === key ? "" : value;
  };
  return { locale, messages, t };
}
