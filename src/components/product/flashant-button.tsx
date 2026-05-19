"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlashantButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  className?: string;
}

export function FlashantButton({
  onClick,
  disabled,
  loading,
  className,
}: FlashantButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200",
        "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          闪象生成中...
        </>
      ) : (
        <>
          <Sparkles size={18} />
          一键闪象
        </>
      )}
    </button>
  );
}
