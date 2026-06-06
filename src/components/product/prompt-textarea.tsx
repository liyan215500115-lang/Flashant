"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PromptTextarea({
  value,
  onChange,
  className,
}: PromptTextareaProps) {
  const { t } = useT();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.promptLabel")}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={t("generate.promptPlaceholder")}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-300 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-700 transition-all resize-y min-h-[88px]"
      />
    </div>
  );
}
