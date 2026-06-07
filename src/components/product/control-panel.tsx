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
          <option value="openai">{t("generate.engineOpenai")}</option>
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

      <PromptTextarea value={prompt} onChange={onPromptChange} />

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
