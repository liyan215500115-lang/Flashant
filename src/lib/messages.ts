import ar from "../../messages/ar.json";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import it from "../../messages/it.json";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";
import ptBR from "../../messages/pt-BR.json";
import zh from "../../messages/zh.json";
import { DEFAULT_LOCALE, resolveLocale, type AppLocale } from "@/lib/locales";
import { translate, type JsonMessage } from "@/lib/translate";

const CATALOGS: Record<AppLocale, JsonMessage> = {
  en,
  zh,
  ja,
  es,
  fr,
  de,
  "pt-BR": ptBR,
  ko,
  it,
  ar,
};

export function getMessages(locale: string | undefined | null): JsonMessage {
  return CATALOGS[resolveLocale(locale)] ?? CATALOGS[DEFAULT_LOCALE];
}

export function createT(messages: JsonMessage) {
  return (key: string) => translate(messages, key);
}
