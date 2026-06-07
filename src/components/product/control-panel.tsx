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
    <div className={cn("flex flex-col gap-6", className)}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{t("generate.tabLabel")}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{t("generate.uploadHint")}</p>
      </div>

      <ImageUploadZone
        projectId={projectId}
        currentImage={currentImage}
        onImageChange={onImageChange}
      />

      <ModeSelect value={mode} onChange={onModeChange} />

      {/* Engine selector */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.engineLabel")}</span>
        <select
          value={engineType}
          onChange={(e) => onEngineTypeChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-300 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-700 transition-all"
        >
          <option value="flux">{t("generate.engineFlux")}</option>
          <option value="sdxl">{t("generate.engineSdxl")}</option>
          <option value="playground">{t("generate.enginePlayground")}</option>
        </select>
      </div>

      {/* Product name — injected into prompt for accurate generation */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.productLabel")}</span>
        <input
          type="text"
          value={productName}
          onChange={(e) => onProductNameChange(e.target.value)}
          placeholder={t("generate.productPlaceholder")}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-300 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-700 transition-all"
        />
      </div>

      {/* Selling points + Magic enhance */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.sellingPointsLabel")}</span>
          <button
            type="button"
            onClick={onEnhancePrompt}
            disabled={isEnhancing || disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            {isEnhancing ? t("generate.enhancing") : t("generate.enhancePrompt")}
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={2}
          placeholder={t("generate.sellingPointsPlaceholder")}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-300 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-700 transition-all resize-y min-h-[72px]"
        />
        {generatedPrompt && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 px-3.5 py-3">
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-1 font-medium">{t("generate.generatedPromptLabel")}</p>
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
