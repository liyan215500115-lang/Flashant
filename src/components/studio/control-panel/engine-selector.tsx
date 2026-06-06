"use client";

import { Select, SelectTrigger, SelectPopover, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface EngineSelectorProps {
  value: string;
  onChange: (engine: string) => void;
  className?: string;
}

export function EngineSelector({ value, onChange, className }: EngineSelectorProps) {
  const { t } = useT();

  const engines = [
    { value: "flux", label: t("generate.engineFlux") },
    { value: "openai", label: t("generate.engineOpenai") },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.engineLabel")}</span>
      <Select value={value} onValueChange={(v) => { if (v !== null) onChange(v); }}>
        <SelectTrigger />
        <SelectPopover>
          {engines.map((e) => (
            <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
          ))}
        </SelectPopover>
      </Select>
    </div>
  );
}
