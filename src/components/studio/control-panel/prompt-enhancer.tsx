"use client";

import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptEnhancerProps {
  currentPrompt: string;
  onEnhanced: (enhancedPrompt: string) => void;
  className?: string;
}

export function PromptEnhancer({ currentPrompt, onEnhanced, className }: PromptEnhancerProps) {
  const [loading, setLoading] = useState(false);

  async function handleEnhance() {
    if (!currentPrompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/prompts/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt }),
      });
      if (!res.ok) return;
      const { enhanced } = await res.json();
      if (enhanced) onEnhanced(enhanced);
    } catch {
      // Silently fail — keep original prompt
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleEnhance}
      disabled={loading || !currentPrompt.trim()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-zinc-50 disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin text-violet-500" />
      ) : (
        <Wand2 size={13} className="text-violet-500" />
      )}
      魔杖
    </button>
  );
}
