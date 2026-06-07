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
    engineType?: string;
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
  const [productName, setProductName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState(4);
  const [engineType, setEngineType] = useState("flux");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  // Build full prompt: product name + scene description
  const buildPrompt = useCallback((product: string, sceneMode: string) => {
    const sceneDesc = modeDefaultPrompts[sceneMode] ?? modeDefaultPrompts.scene;
    return product.trim()
      ? `${product.trim()}, ${sceneDesc.charAt(0).toLowerCase() + sceneDesc.slice(1)}`
      : sceneDesc;
  }, [modeDefaultPrompts]);

  useEffect(() => {
    if (!selectedImage && productImages.length > 0) {
      setSelectedImage(productImages[0]);
    }
  }, [productImages, selectedImage]);

  const handleModeChange = useCallback((newMode: string) => {
    setMode(newMode);
    setPrompt(buildPrompt(productName, newMode));
  }, [buildPrompt, productName]);

  const handleProductChange = useCallback((product: string) => {
    setProductName(product);
    setPrompt(buildPrompt(product, mode));
  }, [buildPrompt, mode]);

  useEffect(() => {
    if (!prompt) {
      setPrompt(buildPrompt(productName, mode));
    }
  }, []);

  // Magic enhance: call vision API to analyze product image + generate prompt
  const handleEnhance = useCallback(async () => {
    if (!selectedImage) return;
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/prompts/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: selectedImage.originalUrl,
          productName,
          sellingPoints: prompt,
          sceneMode: mode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const enhanced = data.enhanced as string;
        setGeneratedPrompt(enhanced);
        setPrompt(enhanced);
      }
    } catch {
      // Fallback to local template
      const fallback = `Professional product photography of ${productName || "product"}. ${productName || "Product"} in a clean bright setting with premium lighting, commercial quality, 8K, sharp focus.`;
      setGeneratedPrompt(fallback);
      setPrompt(fallback);
    } finally {
      setIsEnhancing(false);
    }
  }, [selectedImage, productName, prompt, mode]);

  const succeededImages = generatedImages.filter(
    (img) => img.status === "SUCCEEDED"
  );
  const latestImage = succeededImages[0] ?? null;

  function handleGenerate() {
    if (!selectedImage || isGenerating) return;
    onGenerate({
      productImageId: selectedImage.id,
      prompt: prompt || buildPrompt(productName, mode),
      numOutputs: quantity,
      engineType,
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
        productName={productName}
        onProductNameChange={handleProductChange}
        prompt={prompt}
        onPromptChange={setPrompt}
        quantity={quantity}
        onQuantityChange={setQuantity}
        engineType={engineType}
        onEngineTypeChange={setEngineType}
        generatedPrompt={generatedPrompt}
        onEnhancePrompt={handleEnhance}
        isEnhancing={isEnhancing}
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
