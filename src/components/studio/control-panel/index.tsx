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
  const { t, locale } = useT();
  const isZh = locale === "zh";
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
        body: JSON.stringify({ imageUrl: selectedImage.originalUrl, productName, sellingPoints: prompt, sceneMode: mode, targetLanguage }),
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
    <div className="flex flex-col gap-3">
      {/* Upload */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-3.5">
        {projectId ? (
          <ImageUploadZone projectId={projectId} currentImage={selectedImage} onImageChange={onImageChange} />
        ) : (
          <div className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400">
            {t("generate.noProject")}
          </div>
        )}
      </div>

      {/* Publish + Brand + Tools */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-3.5 flex flex-col gap-3">
        <PublishDestination value={targetPlatform} onChange={onPlatformChange} language={targetLanguage} onLanguageChange={onLanguageChange} />
        <BrandPresetSelector value={brandPresetId} onChange={onBrandPresetChange} />
        {/* Quick tools: bg remove + listing */}
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
            className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors duration-200 cursor-pointer text-center">{t("generate.backgroundLabel")}</button>
          <button type="button"
            onClick={async () => {
              const res = await fetch("/api/listing/generate", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productName, sellingPoints:prompt, platform:targetPlatform})});
              const data = await res.json();
              if (data.title) {
                onPromptChange(`Title: ${data.title}\n\nBullets:\n${(data.bullets||[]).map((b:string)=>`• ${b}`).join("\n")}\n\nDescription: ${data.description}`);
                toast.success("Listing generated");
              } else { toast.error("Failed to generate listing"); }
            }}
            className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors duration-200 cursor-pointer text-center">{t("generate.tabListing")}</button>
        </div>
      </div>

      {/* Generation config */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-3.5 flex flex-col gap-4">
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

        {/* Style presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("landing.nav.styles")}</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "纯白底", prompt: "Product centered on pure white background, soft studio lighting, realistic shadow, e-commerce packshot, 4K", promptZh: "产品居中放置在纯白背景上，柔和摄影棚灯光，逼真阴影，电商白底图风格，4K高清" },
              { label: "影棚光", prompt: "Professional studio product shot, dramatic key light with soft fill, dark moody background, rim lighting, high-end commercial photography, magazine quality", promptZh: "专业影棚产品拍摄，戏剧性主光配柔和补光，深色背景，轮廓光，高端商业摄影质感" },
              { label: "自然光", prompt: "Product in natural outdoor setting, golden hour sunlight, blurred green foliage background, lifestyle photography, warm tones, candid feel", promptZh: "产品置于自然户外场景，黄金时段阳光，虚化绿色植物背景，生活方式摄影风格，温暖色调" },
              { label: "大理石", prompt: "Product placed on elegant white marble surface, soft natural window light, shallow depth of field, luxury aesthetic, professional product photography", promptZh: "产品放置于优雅白色大理石台面，柔和自然窗光，浅景深，奢华质感，专业产品摄影" },
              { label: "生活感", prompt: "Natural lifestyle scene showing product in real use context, warm home or cafe environment, candid photography, relatable and authentic, soft natural lighting", promptZh: "产品在真实使用场景中，温暖居家或咖啡厅环境，抓拍风格，真实自然，柔和自然光" },
              { label: "北欧风", prompt: "Product in a bright Scandinavian interior, minimal decor, natural wood textures, soft diffused daylight, clean composition, editorial e-commerce photography", promptZh: "产品在明亮北欧风室内，极简装饰，天然木纹，柔和散射日光，干净构图，杂志级电商摄影" },
            ].map((s) => (
              <button key={s.label} type="button"
                onClick={() => onPromptChange(isZh ? s.promptZh : s.prompt)}
                className="px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-zinc-700 transition-colors cursor-pointer">
                {s.label}
              </button>
            ))}
          </div>
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
        </div>

        <QuantitySlider value={quantity} onChange={onQuantityChange} />
      </div>

      {/* CTA */}
      <FlashantButton onClick={onGenerate} loading={isGenerating} disabled={!selectedImage || isGenerating}
        label={t("generate.generateCta")} loadingLabel={t("generate.generatingCta")} />
    </div>
  );
}
