"use client";

import { ImageUploadZone } from "./image-upload-zone";
import { ModeSelect } from "./mode-select";
import { PromptTextarea } from "./prompt-textarea";
import { QuantitySlider } from "./quantity-slider";
import { FlashantButton } from "./flashant-button";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface ProductImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

interface ControlPanelProps {
  projectId: string;
  currentImage: ProductImage | null;
  onImageChange: (image: ProductImage) => void;
  mode: string;
  onModeChange: (mode: string) => void;
  productName: string;
  onProductNameChange: (name: string) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  generatedPrompt: string;
  onEnhancePrompt: () => void;
  isEnhancing: boolean;
  engineType: string;
  onEngineTypeChange: (engine: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled: boolean;
  className?: string;
}

export function ControlPanel({
  projectId,
  currentImage,
  onImageChange,
  mode,
  onModeChange,
  productName,
  onProductNameChange,
  prompt,
  onPromptChange,
  quantity,
  onQuantityChange,
  generatedPrompt,
  onEnhancePrompt,
  isEnhancing,
  engineType,
  onEngineTypeChange,
  onGenerate,
  isGenerating,
  disabled,
  className,
}: ControlPanelProps) {
  const { t } = useT();

  return (
    <div className={cn("flex flex-col gap-5", className)}>

      <ImageUploadZone
        projectId={projectId}
        currentImage={currentImage}
        onImageChange={onImageChange}
      />

      {/* Engine selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{t("generate.engineLabel")}</span>
        <select
          value={engineType}
          onChange={(e) => onEngineTypeChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
        >
          <option value="flux">{t("generate.engineFlux")}</option>
          <option value="sdxl">{t("generate.engineSdxl")}</option>
          <option value="playground">{t("generate.enginePlayground")}</option>
        </select>
      </div>

      <ModeSelect value={mode} onChange={onModeChange} />

      {/* Product name */}
      <input
        type="text"
        value={productName}
        onChange={(e) => onProductNameChange(e.target.value)}
        placeholder={t("generate.productPlaceholder")}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
      />

      {/* Selling points + Magic wand */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{t("generate.sellingPointsLabel")}</span>
          <button
            type="button"
            onClick={onEnhancePrompt}
            disabled={isEnhancing || disabled}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            {isEnhancing ? t("generate.enhancing") : t("generate.enhancePrompt")}
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={2}
          placeholder={t("generate.sellingPointsPlaceholder")}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-y min-h-[64px]"
        />
        {generatedPrompt && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2.5">
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-0.5 font-medium">{t("generate.generatedPromptLabel")}</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{generatedPrompt}</p>
          </div>
        )}
      </div>

      <QuantitySlider value={quantity} onChange={onQuantityChange} />

      <FlashantButton
        onClick={onGenerate}
        disabled={disabled}
        loading={isGenerating}
        label={t("generate.generateCta")}
        loadingLabel={t("generate.generatingCta")}
      />
    </div>
  );
}
