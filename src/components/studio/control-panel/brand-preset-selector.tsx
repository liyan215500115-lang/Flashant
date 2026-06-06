"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface BrandPreset {
  id: string;
  name: string;
  logoUrl: string | null;
  colors: string[] | null;
}

interface BrandPresetSelectorProps {
  value: string | null;
  onChange: (presetId: string | null) => void;
}

export function BrandPresetSelector({ value, onChange }: BrandPresetSelectorProps) {
  const { t } = useT();
  const [presets, setPresets] = useState<BrandPreset[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/brand-presets")
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []))
      .catch(() => { toast.error("Failed to load brand presets"); });
  }, []);

  const selected = presets.find((p) => p.id === value) ?? null;

  return (
    <div className="relative">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">{t("generate.brandLabel")}</p>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-left flex items-center justify-between gap-2 hover:border-zinc-300 dark:hover:border-zinc-600 dark:text-zinc-200 transition-colors",
          open && "ring-2 ring-brand-500/20 dark:ring-brand-400/20 border-brand-500 dark:border-brand-400"
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            {selected.logoUrl ? (
              <img src={selected.logoUrl} alt="" className="w-4 h-4 rounded object-cover" />
            ) : null}
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">{t("generate.brandNone")}</span>
        )}
        <ChevronDown size={14} className={cn("text-zinc-400 dark:text-zinc-500 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg py-1 max-h-[200px] overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors",
                !value && "text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20"
              )}
            >
              {t("generate.brandNone")}
            </button>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors",
                  value === p.id && "text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20"
                )}
              >
                {p.logoUrl ? (
                  <img src={p.logoUrl} alt="" className="w-4 h-4 rounded object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-[8px] text-zinc-400 dark:text-zinc-500">
                    {p.name.charAt(0)}
                  </div>
                )}
                <span className="truncate">{p.name}</span>
                {((p.colors as string[]) || []).slice(0, 2).map((c: string) => (
                  <span
                    key={c}
                    className="w-2.5 h-2.5 rounded-full border border-zinc-200 dark:border-zinc-600 ml-auto"
                    style={{ background: c }}
                  />
                ))}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
