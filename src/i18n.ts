import "server-only";

import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import { getAppLocale } from "@/lib/locale.server";
import { getMessages } from "@/lib/messages";

export default getRequestConfig(async () => {
  const locale = await getAppLocale();

  return {
    locale,
    messages: getMessages(locale) as AbstractIntlMessages,
  };
});
