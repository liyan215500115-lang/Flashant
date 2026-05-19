"use client";

import { cn } from "@/lib/utils";

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
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700">场景描述</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="例如：白色大理石桌面，自然柔和光，背景带有高档植物阴影..."
        className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 transition-all resize-y min-h-[88px]"
      />
    </div>
  );
}
