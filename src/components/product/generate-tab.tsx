"use client";

import { useState, useEffect, useCallback } from "react";
import { ControlPanel } from "./control-panel";
import { PreviewCanvas } from "./preview-canvas";
import { cn } from "@/lib/utils";

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

const MODE_DEFAULT_PROMPTS: Record<string, string> = {
  scene: "商品放置在干净明亮的场景中，自然光线，高级质感",
  white_bg: "纯白色背景，专业产品摄影，柔和均匀布光，高细节清晰度",
  model: "时尚模特展示商品，自然互动姿态，柔和自然光，生活化场景",
};

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
  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(
    productImages[0] ?? null
  );
  const [mode, setMode] = useState("scene");
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState(2);

  // Sync selected image when productImages changes
  useEffect(() => {
    if (!selectedImage && productImages.length > 0) {
      setSelectedImage(productImages[0]);
    }
  }, [productImages, selectedImage]);

  // Update prompt when mode changes
  const handleModeChange = useCallback((newMode: string) => {
    setMode(newMode);
    setPrompt(MODE_DEFAULT_PROMPTS[newMode] ?? "");
  }, []);

  // Initialize prompt on first render
  useEffect(() => {
    if (!prompt) {
      setPrompt(MODE_DEFAULT_PROMPTS[mode] ?? "");
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
      prompt: prompt || MODE_DEFAULT_PROMPTS[mode],
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
      />
    </div>
  );
}
