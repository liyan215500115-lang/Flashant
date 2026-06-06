"use client";

import { ImageUploadZone } from "@/components/product/image-upload-zone";
import { ModeSelect } from "@/components/product/mode-select";
import { PromptTextarea } from "@/components/product/prompt-textarea";
import { QuantitySlider } from "@/components/product/quantity-slider";
import { FlashantButton } from "@/components/product/flashant-button";
import { PublishDestination } from "./publish-destination";
import { PromptEnhancer } from "./prompt-enhancer";
import { EngineSelector } from "./engine-selector";
import { BrandPresetSelector } from "./brand-preset-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

interface ProductImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

interface StudioControlPanelProps {
  projectId: string | null;
  selectedImage: ProductImage | null;
  mode: string;
  prompt: string;
  quantity: number;
  engineType: string;
  targetPlatform: string;
  targetLanguage: string;
  brandPresetId: string | null;
  isGenerating: boolean;
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
  projectId,
  selectedImage,
  mode,
  prompt,
  quantity,
  engineType,
  targetPlatform,
  targetLanguage,
  brandPresetId,
  isGenerating,
  onImageChange,
  onModeChange,
  onPromptChange,
  onQuantityChange,
  onEngineChange,
  onPlatformChange,
  onLanguageChange,
  onBrandPresetChange,
  onGenerate,
}: StudioControlPanelProps) {
  const { t } = useT();
  const isAmazon = targetPlatform === "AMAZON";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("generate.tabLabel")}</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("studio.desc")}</p>
      </div>

      {/* Image Upload */}
      {projectId ? (
        <ImageUploadZone
          projectId={projectId}
          currentImage={selectedImage}
          onImageChange={onImageChange}
        />
      ) : (
        <div className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
          {t("generate.noProject")}
        </div>
      )}

      {/* Publish Settings */}
      <Card className="shadow-none overflow-visible">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t("generate.publishGroup")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <PublishDestination
            value={targetPlatform}
            onChange={onPlatformChange}
            language={targetLanguage}
            onLanguageChange={onLanguageChange}
          />
          <BrandPresetSelector value={brandPresetId} onChange={onBrandPresetChange} />
        </CardContent>
      </Card>

      {/* Generation Settings */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t("generate.generateGroup")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ModeSelect
            value={isAmazon ? "white_bg" : mode}
            onChange={onModeChange}
            disabledModes={isAmazon ? ["scene", "model"] : []}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("generate.promptLabel")}</span>
              <PromptEnhancer currentPrompt={prompt} onEnhanced={onPromptChange} />
            </div>
            <PromptTextarea value={prompt} onChange={onPromptChange} />
          </div>

          <QuantitySlider value={quantity} onChange={onQuantityChange} />

          <EngineSelector value={engineType} onChange={onEngineChange} />
        </CardContent>
      </Card>

      {/* Generate button */}
      <FlashantButton
        onClick={onGenerate}
        loading={isGenerating}
        disabled={!selectedImage || isGenerating}
        label={t("generate.generateCta")}
        loadingLabel={t("generate.generatingCta")}
      />
    </div>
  );
}
