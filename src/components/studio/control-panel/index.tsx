"use client";

import { ImageUploadZone } from "@/components/product/image-upload-zone";
import { FlashantButton } from "@/components/product/flashant-button";
import { PublishDestination } from "./publish-destination";
import { BrandPresetSelector } from "./brand-preset-selector";
import { StylePicker } from "./style-picker";
import { PromptEnhancer } from "./prompt-enhancer";
import { useT } from "@/components/i18n-provider";

interface ProductImage {
  id: string; originalUrl: string; fileName: string; mimeType: string;
}

interface StudioControlPanelProps {
  projectId: string | null; selectedImage: ProductImage | null;
  prompt: string; productName: string;
  engineType: string; targetPlatform: string; targetLanguage: string;
  brandPresetId: string | null; isGenerating: boolean;
  activeStyle: string | null;
  onImageChange: (image: ProductImage) => void;
  onAccessoryUpload?: (image: ProductImage) => void;
  accessoryImages?: ProductImage[];
  onPromptChange: (prompt: string) => void;
  onProductNameChange: (name: string) => void;
  onEngineChange: (engine: string) => void;
  onPlatformChange: (platform: string) => void;
  onLanguageChange: (language: string) => void;
  onBrandPresetChange: (presetId: string | null) => void;
  onStyleChange: (key: string, prompt: string) => void;
  onStyleReferenceChange?: (url: string | null) => void;
  onStyleReferenceUploaded?: () => void;
  onGenerate: () => void;
}

export function StudioControlPanel({
  projectId, selectedImage, prompt, productName,
  engineType, targetPlatform, targetLanguage, brandPresetId, isGenerating,
  activeStyle, onImageChange, onAccessoryUpload, accessoryImages, onPromptChange,
  onProductNameChange, onEngineChange, onPlatformChange, onLanguageChange, onBrandPresetChange,
  onStyleChange, onStyleReferenceChange, onStyleReferenceUploaded, onGenerate,
}: StudioControlPanelProps) {
  const { t, locale } = useT();

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── Upload ── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/70 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-md bg-brand-50 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <span className="text-xs font-semibold text-zinc-700">{t("studio.sectionProductImage")}</span>
        </div>
        {projectId ? (
          <ImageUploadZone projectId={projectId} currentImage={selectedImage} onImageChange={onImageChange} onAccessoryUpload={onAccessoryUpload} accessoryImages={accessoryImages} />
        ) : (
          <div className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400 py-12">
            {t("generate.noProject")}
          </div>
        )}
      </div>

      {/* ── 发布设置 ── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/70 shadow-sm p-4 flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-brand-50 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </div>
          <span className="text-xs font-semibold text-zinc-700">{t("studio.sectionPublishSettings")}</span>
        </div>
        <PublishDestination value={targetPlatform} onChange={onPlatformChange} language={targetLanguage} onLanguageChange={onLanguageChange} />
        <BrandPresetSelector value={brandPresetId} onChange={onBrandPresetChange} />
      </div>

      {/* ── 生成设置 ── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/70 shadow-sm p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-brand-50 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
          </div>
          <span className="text-xs font-semibold text-zinc-700">{t("studio.sectionGenerateSettings")}</span>
        </div>

        {/* Engine */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">{t("generate.engineLabel")}</span>
          <select value={engineType} onChange={(e) => onEngineChange(e.target.value)}
            className="w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs text-zinc-700 dark:text-zinc-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all">
            <option value="flux">{t("generate.engineFlux")}</option>
            <option value="gpt-image">{t("generate.engineGptImage")}</option>
          </select>
        </div>

        {/* Product name */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">{t("generate.productLabel")}</span>
          <input type="text" value={productName} onChange={(e) => onProductNameChange(e.target.value)}
            placeholder={t("generate.productPlaceholder")}
            className="w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all" />
        </div>

        {/* Style */}
        <StylePicker value={activeStyle} onChange={onStyleChange} onReferenceImage={onStyleReferenceChange} onReferenceImageUploaded={onStyleReferenceUploaded} engineType={engineType} />

        {/* Prompt + AI enhancer */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500">{t("generate.sellingPointsLabel")}</span>
          </div>
          <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} rows={2}
            placeholder={t("generate.sellingPointsPlaceholder")}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-xs text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-y min-h-[56px]" />
          <PromptEnhancer
            imageUrl={selectedImage?.originalUrl ?? null}
            productName={productName}
            currentPrompt={prompt}
            styleName={activeStyle}
            onEnhanced={onPromptChange}
          />
        </div>
      </div>

      {/* CTA */}
      <FlashantButton onClick={onGenerate} loading={isGenerating} disabled={!selectedImage || isGenerating}
        label={t("generate.generateCta")} loadingLabel={t("generate.generatingCta")} />
    </div>
  );
}
