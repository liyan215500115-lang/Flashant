"use client";

import { Image, Ruler, FileImage, FileType, Globe } from "lucide-react";
import { Select, SelectTrigger, SelectPopover, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { PLATFORM_LIST, type PlatformImageSpec } from "@/lib/platform-specs";
import { usePlatformSpec } from "@/lib/use-platform-specs";

function SpecBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded-md px-2 py-0.5">
      {children}
    </span>
  );
}

function LocalizedSelectItem({ spec }: { spec: PlatformImageSpec }) {
  const localized = usePlatformSpec(spec);
  return <SelectItem value={spec.platform}>{localized.localizedName}</SelectItem>;
}

function PlatformSpecCard({ spec }: { spec: PlatformImageSpec }) {
  const { t } = useT();
  const localized = usePlatformSpec(spec);

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <Image size={11} />
        {t("generate.imageSpec").replace("{name}", localized.localizedName)}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <SpecBadge>
          <Ruler size={9} />
          {spec.dimensions}
        </SpecBadge>
        <SpecBadge>
          <FileImage size={9} />
          {spec.ratio}
        </SpecBadge>
        <SpecBadge>
          <FileType size={9} />
          {spec.formats.join(" / ")}
        </SpecBadge>
      </div>

      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed space-y-0.5">
        <p>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">{t("generate.backgroundLabel")}：</span>
          {localized.localizedBackground}
        </p>
        <p>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">{t("generate.quantityLabel")}：</span>
          {t("generate.maxImagesInfo").replace("{max}", String(spec.maxImages)).replace("{size}", spec.maxFileSize)}
        </p>
        {localized.localizedNotes.slice(0, 2).map((note, i) => (
          <p key={i} className="text-zinc-400 dark:text-zinc-500">
            · {note}
          </p>
        ))}
      </div>
    </div>
  );
}

interface PublishDestinationProps {
  value: string;
  onChange: (platform: string) => void;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  className?: string;
}

export function PublishDestination({ value, onChange, language, onLanguageChange, className }: PublishDestinationProps) {
  const { t } = useT();
  const spec = value ? PLATFORM_LIST.find((p) => p.platform === value) : undefined;
  const langs = spec?.languages ?? [];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.platformLabel")}</span>
      <Select value={value} onValueChange={(v) => { if (v !== null) onChange(v); }}>
        <SelectTrigger
          renderValue={(v) => {
            const key = `platforms.${v}.name`;
            const localized = t(key);
            return localized !== key ? localized : PLATFORM_LIST.find((p) => p.platform === v)?.name ?? v;
          }}
        />
        <SelectPopover>
          <SelectItem value="">{t("generate.platformNone")}</SelectItem>
          {PLATFORM_LIST.map((p) => (
            <LocalizedSelectItem key={p.platform} spec={p} />
          ))}
        </SelectPopover>
      </Select>

      {/* Language selector — shown when platform has multiple languages */}
      {langs.length > 0 && onLanguageChange && (
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Globe size={10} />
            {t("generate.languageLabel")}
          </span>
          <Select value={language ?? langs[0].code} onValueChange={(v) => { if (v !== null) onLanguageChange(v); }}>
            <SelectTrigger renderValue={(v) => langs.find((l) => l.code === v)?.label ?? v} />
            <SelectPopover>
              {langs.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectPopover>
          </Select>
        </div>
      )}

      {spec && <PlatformSpecCard spec={spec} />}
    </div>
  );
}
