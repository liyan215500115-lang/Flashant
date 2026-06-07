import "server-only";

import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import zh from "../messages/zh.json";
import en from "../messages/en.json";

export default getRequestConfig(async () => {
  const SUPPORTED_LOCALES = ["en", "zh", "es", "pt-BR", "ja", "de", "fr", "ko", "ar", "it"];
  let locale = "en";
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get("NEXT_LOCALE")?.value;
    if (cookieVal && SUPPORTED_LOCALES.includes(cookieVal)) {
      locale = cookieVal;
    }
  } catch {
    // cookies() may throw during static generation — fall back to "en"
  }

  return {
    locale,
    messages: locale === "zh" ? zh : en,
  };
});
