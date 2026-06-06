"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface ModeSelectProps {
  value: string;
  onChange: (mode: string) => void;
  disabledModes?: string[];
  className?: string;
}

export function ModeSelect({ value, onChange, disabledModes = [], className }: ModeSelectProps) {
  const { t } = useT();

  const modes = [
    { value: "scene", label: t("generate.modeScene") },
    { value: "white_bg", label: t("generate.modeWhiteBg") },
    { value: "model", label: t("generate.modeModel") },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.modeLabel")}</span>
      <Tabs
        value={value}
        onValueChange={onChange}
        className="w-full"
      >
        <TabsList className="w-full">
          {modes.map((mode) => {
            const isDisabled = disabledModes.includes(mode.value);
            return (
              <TabsTrigger
                key={mode.value}
                value={mode.value}
                className="flex-1"
                disabled={isDisabled}
              >
                {mode.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
