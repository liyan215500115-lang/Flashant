"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ControlPanel } from "./control-panel";
import { PreviewCanvas } from "./preview-canvas";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface ProductImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  status: string;
  promptUsed: string | null;
  createdAt: string;
}

interface GenerateTabProps {
  projectId: string;
  productImages: ProductImage[];
  generatedImages: GeneratedImage[];
  quotaUsed: number;
  quotaLimit: number;
  onGenerate: (params: {
    productImageId: string;
    prompt: string;
    numOutputs: number;
  }) => void;
  isGenerating: boolean;
  onImageUploaded: (image: ProductImage) => void;
  className?: string;
}

export function GenerateTab({
  projectId,
  productImages,
  generatedImages,
  quotaUsed,
  quotaLimit,
  onGenerate,
  isGenerating,
  onImageUploaded,
  className,
}: GenerateTabProps) {
  const { t } = useT();

  const modeDefaultPrompts = useMemo<Record<string, string>>(() => ({
    scene: t("generate.sceneDefaultPrompt"),
    white_bg: t("generate.whiteBgDefaultPrompt"),
    model: t("generate.modelDefaultPrompt"),
  }), [t]);

  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(
    productImages[0] ?? null
  );
  const [mode, setMode] = useState("scene");
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState(2);

  useEffect(() => {
    if (!selectedImage && productImages.length > 0) {
      setSelectedImage(productImages[0]);
    }
  }, [productImages, selectedImage]);

  const handleModeChange = useCallback((newMode: string) => {
    setMode(newMode);
    setPrompt(modeDefaultPrompts[newMode] ?? "");
  }, [modeDefaultPrompts]);

  useEffect(() => {
    if (!prompt) {
      setPrompt(modeDefaultPrompts[mode] ?? "");
    }
  }, []);

  const succeededImages = generatedImages.filter(
    (img) => img.status === "SUCCEEDED"
  );
  const latestImage = succeededImages[0] ?? null;

  function handleGenerate() {
    if (!selectedImage || isGenerating) return;
    onGenerate({
      productImageId: selectedImage.id,
      prompt: prompt || modeDefaultPrompts[mode],
      numOutputs: quantity,
    });
  }

  return (
    <div
      className={cn("flex gap-6 items-start", className)}
    >
      <ControlPanel
        projectId={projectId}
        currentImage={selectedImage}
        onImageChange={(img) => {
          setSelectedImage(img);
          onImageUploaded(img);
        }}
        mode={mode}
        onModeChange={handleModeChange}
        prompt={prompt}
        onPromptChange={setPrompt}
        quantity={quantity}
        onQuantityChange={setQuantity}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        disabled={!selectedImage}
      />

      <PreviewCanvas
        isGenerating={isGenerating}
        generatedImages={succeededImages}
        latestImage={latestImage}
        quotaUsed={quotaUsed}
        quotaLimit={quotaLimit}
        projectId={projectId}
      />
    </div>
  );
}
