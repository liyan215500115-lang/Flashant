"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlashantButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
}

export function FlashantButton({
  onClick,
  disabled,
  loading,
  label = "一键闪象",
  loadingLabel = "闪象生成中...",
  className,
}: FlashantButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200",
        "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Sparkles size={18} />
          {label}
        </>
      )}
    </button>
  );
}
