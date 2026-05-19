"use client";

import { ImageUploadZone } from "./image-upload-zone";
import { ModeSelect } from "./mode-select";
import { PromptTextarea } from "./prompt-textarea";
import { QuantitySlider } from "./quantity-slider";
import { FlashantButton } from "./flashant-button";
import { cn } from "@/lib/utils";

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
  prompt: string;
  onPromptChange: (prompt: string) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
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
  prompt,
  onPromptChange,
  quantity,
  onQuantityChange,
  onGenerate,
  isGenerating,
  disabled,
  className,
}: ControlPanelProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Product slogan */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">一键闪象</h2>
        <p className="text-xs text-zinc-500 mt-0.5">万象更新</p>
      </div>

      <ImageUploadZone
        projectId={projectId}
        currentImage={currentImage}
        onImageChange={onImageChange}
      />

      <ModeSelect value={mode} onChange={onModeChange} />

      <PromptTextarea value={prompt} onChange={onPromptChange} />

      <QuantitySlider value={quantity} onChange={onQuantityChange} />

      <FlashantButton
        onClick={onGenerate}
        disabled={disabled}
        loading={isGenerating}
      />
    </div>
  );
}
