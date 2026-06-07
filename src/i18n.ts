import "server-only";

import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import zh from "../messages/zh.json";
import en from "../messages/en.json";

export default getRequestConfig(async () => {
  let locale = "en";
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get("NEXT_LOCALE")?.value;
    if (cookieVal && ["en", "zh"].includes(cookieVal)) {
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
