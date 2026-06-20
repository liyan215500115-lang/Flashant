"use client";

import { useState } from "react";
import { Wand2, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface PromptEnhancerProps {
  imageUrl: string | null;
  productName: string;
  currentPrompt: string;
  styleName: string | null;
  onEnhanced: (enhancedPrompt: string) => void;
  className?: string;
}

export function PromptEnhancer({
  imageUrl,
  productName,
  currentPrompt,
  styleName,
  onEnhanced,
  className,
}: PromptEnhancerProps) {
  const { t, locale } = useT();
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState("");

  async function handleEnhance() {
    if (!imageUrl) return;
    setLoading(true);
    try {
      const res = await fetch("/api/prompts/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          productName: productName || undefined,
          sellingPoints: currentPrompt || undefined,
          styleName: styleName || undefined,
          targetLanguage: locale,
        }),
      });
      if (!res.ok) return;
      const { enhanced, reasoning } = await res.json();
      if (enhanced) {
        setLastGenerated(enhanced);
        onEnhanced(enhanced);
      }
    } catch {
      // Silently fail — keep original prompt
    } finally {
      setLoading(false);
    }
  }

  const disabled = !imageUrl || loading;

  return (
    <button
      type="button"
      onClick={handleEnhance}
      disabled={disabled}
      className={cn(
        "relative w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 text-xs font-semibold transition-all duration-300",
        disabled
          ? "border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
          : "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:shadow-sm cursor-pointer animate-in fade-in",
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 size={15} className="animate-spin text-amber-500" />
          <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            {locale === "zh" ? "正在分析产品并生成提示词..." : "Analyzing product & writing prompt..."}
          </span>
        </>
      ) : lastGenerated ? (
        <>
          <Sparkles size={15} className="text-amber-500" />
          <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            {locale === "zh" ? "重新智能生成" : "Regenerate AI Prompt"}
          </span>
        </>
      ) : (
        <>
          <Wand2 size={15} className="text-amber-500" />
          <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            {locale === "zh" ? "AI 智能写提示词" : "AI Auto-Write Prompt"}
          </span>
        </>
      )}
    </button>
  );
}
