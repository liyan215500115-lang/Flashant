"use client";

import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ENGINES = [
  { value: "flux", label: "标准 Flux (Replicate)" },
  { value: "openai", label: "奢华 GPT (DALL·E 3)" },
];

interface EngineSelectorProps {
  value: string;
  onChange: (engine: string) => void;
  className?: string;
}

export function EngineSelector({ value, onChange, className }: EngineSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700">AI 算力引擎</span>
      <Select
        options={ENGINES}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
