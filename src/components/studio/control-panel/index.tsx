"use client";

import { useState } from "react";
import { ImageUploadZone } from "@/components/product/image-upload-zone";
import { ModeSelect } from "@/components/product/mode-select";
import { QuantitySlider } from "@/components/product/quantity-slider";
import { FlashantButton } from "@/components/product/flashant-button";
import { PublishDestination } from "./publish-destination";
import { BrandPresetSelector } from "./brand-preset-selector";
import { useT } from "@/components/i18n-provider";
import { toast } from "sonner";

interface ProductImage {
  id: string; originalUrl: string; fileName: string; mimeType: string;
}

interface StudioControlPanelProps {
  projectId: string | null; selectedImage: ProductImage | null;
  mode: string; prompt: string; quantity: number;
  engineType: string; targetPlatform: string; targetLanguage: string;
  brandPresetId: string | null; isGenerating: boolean;
  onImageChange: (image: ProductImage) => void;
  onModeChange: (mode: string) => void;
  onPromptChange: (prompt: string) => void;
  onQuantityChange: (quantity: number) => void;
  onEngineChange: (engine: string) => void;
  onPlatformChange: (platform: string) => void;
  onLanguageChange: (language: string) => void;
  onBrandPresetChange: (presetId: string | null) => void;
  onGenerate: () => void;
}

export function StudioControlPanel({
  projectId, selectedImage, mode, prompt, quantity,
  engineType, targetPlatform, targetLanguage, brandPresetId, isGenerating,
  onImageChange, onModeChange, onPromptChange, onQuantityChange,
  onEngineChange, onPlatformChange, onLanguageChange, onBrandPresetChange,
  onGenerate,
}: StudioControlPanelProps) {
  const { t } = useT();
  const isAmazon = targetPlatform === "AMAZON";
  const [productName, setProductName] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [recipeName, setRecipeName] = useState("");

  // Magic wand: call DeepSeek to enhance selling points
  async function handleEnhance() {
    if (!selectedImage) return;
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/prompts/enhance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: selectedImage.originalUrl, productName, sellingPoints: prompt, sceneMode: mode }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedPrompt(data.enhanced);
        onPromptChange(data.enhanced);
      }
    } catch { /* fallback to template */ }
    finally { setIsEnhancing(false); }
  }

  // Recipe save
  function saveRecipe() {
    const recipe = { mode, prompt, productName, quantity, engineType, targetPlatform };
    localStorage.setItem(`flashant-recipe-${recipeName || Date.now()}`, JSON.stringify(recipe));
    toast.success("Recipe saved");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Upload */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-4">
        {projectId ? (
          <ImageUploadZone projectId={projectId} currentImage={selectedImage} onImageChange={onImageChange} />
        ) : (
          <div className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400">
            {t("generate.noProject")}
          </div>
        )}
      </div>

      {/* Publish + Brand + Tools */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-4 flex flex-col gap-3">
        <PublishDestination value={targetPlatform} onChange={onPlatformChange} language={targetLanguage} onLanguageChange={onLanguageChange} />
        <BrandPresetSelector value={brandPresetId} onChange={onBrandPresetChange} />
        {/* Quick tools: bg remove + listing + language */}
        <div className="flex gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
          <button type="button"
            onClick={async () => {
              if (!selectedImage) return;
              toast.promise(
                fetch("/api/bg-remove", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageUrl:selectedImage.originalUrl})})
                  .then(r=>r.json()).then(d=>{if(d.url)onImageChange({...selectedImage,originalUrl:d.url})}),
                {loading:"Removing background...",success:"Done!",error:"Failed"}
              );
            }}
            className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-center">✂️ Remove BG</button>
          <button type="button"
            onClick={async () => {
              const res = await fetch("/api/listing/generate", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productName, sellingPoints:prompt, platform:targetPlatform})});
              const data = await res.json();
              if (data.title) {
                onPromptChange(`Title: ${data.title}\n\nBullets:\n${(data.bullets||[]).map((b:string)=>`• ${b}`).join("\n")}\n\nDescription: ${data.description}`);
                toast.success("Listing generated");
              } else { toast.error("Failed to generate listing"); }
            }}
            className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-center">📝 Listing</button>
          <select value={targetLanguage} onChange={(e) => onLanguageChange(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 cursor-pointer border-0">
            <option value="en">🇺🇸 EN</option>
            <option value="zh">🇨🇳 中文</option>
            <option value="es">🇪🇸 ES</option>
            <option value="pt-BR">🇧🇷 PT</option>
            <option value="ja">🇯🇵 日本語</option>
            <option value="de">🇩🇪 DE</option>
          </select>
        </div>
      </div>

      {/* Generation config */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-4 flex flex-col gap-4">
        {/* Engine */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("generate.engineLabel")}</span>
          <select value={engineType} onChange={(e) => onEngineChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all">
            <option value="flux">{t("generate.engineFlux")}</option>
            <option value="flux2">FLUX.2 Pro</option>
            <option value="sdxl">{t("generate.engineSdxl")}</option>
            <option value="playground">{t("generate.enginePlayground")}</option>
          </select>
        </div>

        {/* Mode */}
        <ModeSelect value={isAmazon ? "white_bg" : mode} onChange={onModeChange} disabledModes={isAmazon ? ["scene", "model"] : []} />

        {/* Product name */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("generate.productLabel")}</span>
          <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
            placeholder={t("generate.productPlaceholder")}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all" />
        </div>

        {/* Selling points + Magic wand */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("generate.sellingPointsLabel")}</span>
            <button type="button" onClick={handleEnhance} disabled={isEnhancing || !selectedImage}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50 cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              {isEnhancing ? "..." : t("generate.enhancePrompt")}
            </button>
          </div>
          <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} rows={2}
            placeholder={t("generate.sellingPointsPlaceholder")}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-y min-h-[60px]" />
          {generatedPrompt && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2.5">
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-0.5 font-medium">AI Generated</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{generatedPrompt}</p>
            </div>
          )}
        </div>

        <QuantitySlider value={quantity} onChange={onQuantityChange} />

        {/* Recipe save */}
        <div className="flex gap-1.5">
          <input type="text" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="Recipe name"
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none transition-all" />
          <button type="button" onClick={saveRecipe} disabled={!selectedImage}
            className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer">Save Recipe</button>
        </div>
      </div>

      {/* CTA */}
      <FlashantButton onClick={onGenerate} loading={isGenerating} disabled={!selectedImage || isGenerating}
        label={t("generate.generateCta")} loadingLabel={t("generate.generatingCta")} />
    </div>
  );
}
