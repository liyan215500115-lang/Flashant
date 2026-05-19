"use client";

import { ImageUploadZone } from "@/components/product/image-upload-zone";
import { ModeSelect } from "@/components/product/mode-select";
import { PromptTextarea } from "@/components/product/prompt-textarea";
import { QuantitySlider } from "@/components/product/quantity-slider";
import { FlashantButton } from "@/components/product/flashant-button";
import { PublishDestination } from "./publish-destination";
import { PromptEnhancer } from "./prompt-enhancer";
import { EngineSelector } from "./engine-selector";

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
  isGenerating: boolean;
  onImageChange: (image: ProductImage) => void;
  onModeChange: (mode: string) => void;
  onPromptChange: (prompt: string) => void;
  onQuantityChange: (quantity: number) => void;
  onEngineChange: (engine: string) => void;
  onPlatformChange: (platform: string) => void;
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
  isGenerating,
  onImageChange,
  onModeChange,
  onPromptChange,
  onQuantityChange,
  onEngineChange,
  onPlatformChange,
  onGenerate,
}: StudioControlPanelProps) {
  const isAmazon = targetPlatform === "AMAZON";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">一键闪象</h2>
        <p className="text-xs text-zinc-500">万象更新</p>
      </div>

      {/* Publish destination — new, top priority */}
      <PublishDestination value={targetPlatform} onChange={onPlatformChange} />

      {/* Image upload */}
      {projectId ? (
        <ImageUploadZone
          projectId={projectId}
          currentImage={selectedImage}
          onImageChange={onImageChange}
        />
      ) : (
        <div className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 flex items-center justify-center text-sm text-zinc-400">
          请先创建项目
        </div>
      )}

      {/* Mode select — with Amazon restrictions */}
      <ModeSelect
        value={isAmazon ? "white_bg" : mode}
        onChange={onModeChange}
        disabledModes={isAmazon ? ["scene", "model"] : []}
      />

      {/* Prompt with enhancer */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">场景描述</span>
          <PromptEnhancer currentPrompt={prompt} onEnhanced={onPromptChange} />
        </div>
        <PromptTextarea value={prompt} onChange={onPromptChange} />
      </div>

      {/* Quantity */}
      <QuantitySlider value={quantity} onChange={onQuantityChange} />

      {/* Engine selector — new */}
      <EngineSelector value={engineType} onChange={onEngineChange} />

      {/* Generate button */}
      <FlashantButton
        onClick={onGenerate}
        loading={isGenerating}
        disabled={!selectedImage || isGenerating}
      />
    </div>
  );
}
