"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface QuantitySliderProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function QuantitySlider({
  value,
  onChange,
  className,
}: QuantitySliderProps) {
  const { t } = useT();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.quantityLabel")}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">{t("generate.quantityUnit").replace("{count}", String(value))}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        min={1}
        max={4}
        step={1}
        className="mt-1"
      />
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
        <span>1</span>
        <span>4</span>
      </div>
    </div>
  );
}
