"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "scene", label: "场景图" },
  { value: "white_bg", label: "白底图" },
  { value: "model", label: "模特上身" },
] as const;

interface ModeSelectProps {
  value: string;
  onChange: (mode: string) => void;
  disabledModes?: string[];
  className?: string;
}

export function ModeSelect({ value, onChange, disabledModes = [], className }: ModeSelectProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700">生成模式</span>
      <Tabs
        value={value}
        onValueChange={onChange}
        className="w-full"
      >
        <TabsList className="w-full">
          {MODES.map((mode) => {
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
