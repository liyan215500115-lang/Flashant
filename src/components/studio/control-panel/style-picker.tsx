"use client";

import { useState, useRef } from "react";
import { Square, Image, User, Gem, Sun, Home, Coffee, Grid3X3, Palette, Smile } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { STYLE_PROMPTS } from "@/lib/ai/style-prompts";

interface StyleDef {
  key: string; zh: string; en: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  prompt: string; promptZh: string;          // Gemini/GPT (full description)
  promptFlux: string; promptFluxZh: string;  // FLUX (scene-only, ~20-30 words)
}

const STYLE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  white: Square,
  scene: Image,
  in_use: User,
  angles: Grid3X3,
  marble: Gem,
  natural: Sun,
  cosy: Home,
  dark_moody: Coffee,
  cyberpunk: Coffee,
  canvas: Palette,
  kawaii: Smile,
  infographic: Image,
};

const STYLES: StyleDef[] = STYLE_PROMPTS.map((style) => ({
  ...style,
  icon: STYLE_ICONS[style.key] ?? Square,
}));


interface StylePickerProps {
  value: string | null;
  engineType?: string;
  onChange: (key: string, prompt: string) => void;
  onReferenceImage?: (url: string | null) => void;
  onReferenceImageUploaded?: () => void;
}

export function StylePicker({ value, onChange, onReferenceImage, onReferenceImageUploaded, engineType }: StylePickerProps) {
  const { t, locale } = useT();
  const isZh = locale === "zh";
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function select(s: StyleDef) {
    // FLUX (flux-2-pro img2img): scene-focused prompt with explicit style keywords +
    //   "keep the product identical to the reference image" instruction (see promptFlux).
    // GPT Image (text-to-image, no reference): full product+scene description (prompt).
    // Bria (product-preserving bg swap): reuses promptFlux but STRIPS the "keep the
    //   product identical" clause — bria preserves the product automatically, and that
    //   instruction is irrelevant to it and can even confuse it (see bria.ts).
    let prompt: string;
    if (engineType === "flux" || engineType === "bria") {
      prompt = isZh ? s.promptFluxZh : s.promptFlux;
      if (engineType === "bria") {
        prompt = prompt
          .replace(/Keep the product identical to the reference image,?\s*/i, "")
          .replace(/保持产品与参考图完全一致[，,]?\s*/g, "");
      }
    } else {
      prompt = isZh ? s.promptZh : s.prompt;
    }
    onChange(s.key === value ? "" : s.key, s.key === value ? "" : prompt);
  }

  function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRefUrl(url);
    onReferenceImage?.(url);
    onReferenceImageUploaded?.(); // notify parent to auto-switch to FLUX for img2img
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("landing.nav.styles")}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {STYLES.map((s) => {
          const Icon = s.icon;
          const isActive = value === s.key;
          return (
            <button key={s.key} type="button" onClick={() => select(s)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                isActive ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500/20" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}>
              <Icon size={18} className={isActive ? "text-brand-600" : ""} />
              <span className="text-[10px] font-medium leading-tight text-center">{isZh ? s.zh : s.en}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg border border-dashed border-zinc-300 text-[10px] text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 transition-colors cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          {refUrl ? (isZh ? "已上传参考图" : "Reference set") : (isZh ? "参考风格图" : "Style Reference")}
        </button>
        {refUrl && <button type="button" onClick={() => { setRefUrl(null); onReferenceImage?.(null); }} className="text-[10px] text-red-400 hover:text-red-600 px-1">{isZh ? "清除" : "Clear"}</button>}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
      </div>
    </div>
  );
}
