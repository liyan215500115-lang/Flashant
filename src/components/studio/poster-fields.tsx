"use client";

import { useT } from "@/components/i18n-provider";
import { POSTER_LANGUAGES, type PosterLanguage } from "@/lib/poster/options";

export type PosterTemplateChoice = "auto" | "A" | "B" | "C";

export interface PosterTagDraft {
  en: string;
  cn: string;
}

const INPUT = "w-full rounded-md border border-zinc-200 px-2 py-1 text-[10px] placeholder:text-zinc-300 focus:border-brand-500 focus:outline-none";

/**
 * Optional poster controls in the same quiet style as the spec group.
 * Fields start empty. Placeholders are hints only. Changing language
 * does not rewrite or translate the text the merchant already typed.
 */
export function PosterFields(props: {
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  language: PosterLanguage;
  onLanguage: (value: PosterLanguage) => void;
  template: PosterTemplateChoice;
  onTemplate: (value: PosterTemplateChoice) => void;
  series: string;
  title: string;
  dek: string;
  tags: PosterTagDraft[];
  onSeries: (value: string) => void;
  onTitle: (value: string) => void;
  onDek: (value: string) => void;
  onTag: (index: number, field: "en" | "cn", value: string) => void;
  canReapply: boolean;
  reapplying: boolean;
  onReapply: () => void;
}) {
  const { t } = useT();
  const languageLabel: Record<PosterLanguage, string> = {
    zh: t("studio.poster.langZh"),
    en: t("studio.poster.langEn"),
    ja: t("studio.poster.langJa"),
    ko: t("studio.poster.langKo"),
  };
  const templates: Array<{ id: PosterTemplateChoice; label: string }> = [
    { id: "auto", label: t("studio.poster.auto") },
    { id: "A", label: t("studio.poster.templateA") },
    { id: "B", label: t("studio.poster.templateB") },
    { id: "C", label: t("studio.poster.templateC") },
  ];

  return (
    <div className="mb-3 rounded-lg border border-zinc-200 px-2.5 py-2" data-testid="poster-fields">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          data-testid="poster-toggle"
          checked={props.enabled}
          onChange={(event) => props.onEnabled(event.target.checked)}
          className="w-3.5 h-3.5 rounded accent-brand-600"
        />
        <span className="text-xs font-medium text-zinc-700">{t("studio.poster.toggle")}</span>
      </label>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
        {props.enabled ? t("studio.poster.onHint") : t("studio.poster.offHint")}
      </p>
      {props.enabled && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] leading-relaxed text-zinc-400">{t("studio.poster.scope")}</p>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-zinc-500">{t("studio.poster.language")}</span>
            <select
              data-testid="poster-language"
              value={props.language}
              onChange={(event) => props.onLanguage(event.target.value as PosterLanguage)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] text-zinc-700"
            >
              {POSTER_LANGUAGES.map((code) => (
                <option key={code} value={code}>{languageLabel[code]}</option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] leading-relaxed text-zinc-400">{t("studio.poster.languageHint")}</span>
          </label>
          <div>
            <span className="mb-1 block text-[10px] font-medium text-zinc-500">{t("studio.poster.template")}</span>
            <div className="flex flex-wrap gap-1">
              {templates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => props.onTemplate(item.id)}
                  className={`text-[10px] px-2 py-1 rounded-md border cursor-pointer ${
                    props.template === item.id
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white border-zinc-200 text-zinc-500"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-zinc-500">{t("studio.poster.series")}</span>
            <input data-testid="poster-series" value={props.series} onChange={(event) => props.onSeries(event.target.value)} placeholder={t("studio.poster.seriesPlaceholder")} className={INPUT} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-zinc-500">{t("studio.poster.fieldTitle")}</span>
            <input data-testid="poster-title" value={props.title} onChange={(event) => props.onTitle(event.target.value)} placeholder={t("studio.poster.titlePlaceholder")} className={INPUT} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-zinc-500">{t("studio.poster.dek")}</span>
            <input data-testid="poster-dek" value={props.dek} onChange={(event) => props.onDek(event.target.value)} placeholder={t("studio.poster.dekPlaceholder")} className={INPUT} />
          </label>
          <div>
            <span className="mb-1 block text-[10px] text-zinc-500">{t("studio.poster.tags")}</span>
            <div className="space-y-1">
              {props.tags.map((tag, index) => (
                <div key={index} className="grid grid-cols-2 gap-1">
                  <input
                    data-testid={`poster-tag-en-${index}`}
                    value={tag.en}
                    onChange={(event) => props.onTag(index, "en", event.target.value)}
                    placeholder={t("studio.poster.tagEnPlaceholder")}
                    aria-label={`${t("studio.poster.tagEn")} ${index + 1}`}
                    className={INPUT}
                  />
                  <input
                    data-testid={`poster-tag-cn-${index}`}
                    value={tag.cn}
                    onChange={(event) => props.onTag(index, "cn", event.target.value)}
                    placeholder={t("studio.poster.tagCnPlaceholder")}
                    aria-label={`${t("studio.poster.tagCn")} ${index + 1}`}
                    className={INPUT}
                  />
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-400">{t("studio.poster.emptyHint")}</p>
          <button
            type="button"
            data-testid="poster-reapply"
            disabled={!props.canReapply || props.reapplying}
            onClick={props.onReapply}
            className="w-full rounded-md border border-zinc-200 px-2 py-1 text-[10px] text-zinc-600 disabled:opacity-40"
          >
            {props.reapplying ? t("studio.poster.reapplying") : t("studio.poster.reapply")}
          </button>
        </div>
      )}
    </div>
  );
}
