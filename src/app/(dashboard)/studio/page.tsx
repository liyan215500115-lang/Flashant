"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioControlPanel } from "@/components/studio/control-panel";
import { StudioPreviewCanvas } from "@/components/studio/preview-canvas";
import { useT } from "@/components/i18n-provider";

interface ProductImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

interface PreviewImage {
  id: string;
  url: string;
  promptUsed?: string;
}

export default function StudioPage() {
  const { t } = useT();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectCreating, setProjectCreating] = useState(true);
  const [projectError, setProjectError] = useState("");

  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [mode, setMode] = useState("scene");
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState(2);
  const [engineType, setEngineType] = useState("flux");
  const [targetPlatform, setTargetPlatform] = useState("SHOPIFY");
  const [isGenerating, setIsGenerating] = useState(false);

  const [latestImage, setLatestImage] = useState<PreviewImage | null>(null);
  const [assetImages, setAssetImages] = useState<PreviewImage[]>([]);
  const [activeTab, setActiveTab] = useState("main");

  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(-1);

  async function createProject() {
    setProjectCreating(true);
    setProjectError("");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      if (data.project?.id) {
        setProjectId(data.project.id);
      } else {
        throw new Error("Invalid server response");
      }
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : t("studio.projectError"));
    } finally {
      setProjectCreating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    createProject().then(() => {
      if (cancelled) return;
      fetch("/api/quota")
        .then((r) => r.json())
        .then((d) => {
          setQuotaUsed(d.used ?? 0);
          setQuotaLimit(d.limit ?? -1);
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  const pollTask = useCallback(
    async (taskId: string) => {
      const MAX_POLLS = 40;
      let polls = 0;

      const poll = async (): Promise<void> => {
        if (polls >= MAX_POLLS) { setIsGenerating(false); return; }
        polls++;
        try {
          const res = await fetch(`/api/tasks/${taskId}`);
          const data = await res.json();
          if (data.result?.url) {
            setLatestImage({ id: data.result.id, url: data.result.url, promptUsed: prompt });
            setIsGenerating(false);
            fetch("/api/quota").then((r) => r.json()).then((d) => setQuotaUsed(d.used ?? 0)).catch(() => {});
            return;
          }
          if (data.task?.status === "FAILED") { setIsGenerating(false); return; }
          if (data.poll) { setTimeout(() => { poll(); }, data.nextPollMs ?? 3000); }
          else { setIsGenerating(false); }
        } catch { setIsGenerating(false); }
      };
      poll();
    },
    [prompt]
  );

  async function handleGenerate() {
    if (!projectId || !selectedImage || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: projectId,
          productImageId: selectedImage.id,
          prompt: prompt || undefined,
          numOutputs: quantity,
          engineType,
        }),
      });
      const data = await res.json();
      if (data.status === "succeeded") {
        setLatestImage({ id: data.generatedImageId, url: data.url, promptUsed: prompt });
        setIsGenerating(false);
        fetch("/api/quota").then((r) => r.json()).then((d) => setQuotaUsed(d.used ?? 0)).catch(() => {});
      } else if (data.taskId) {
        pollTask(data.taskId);
      } else {
        setIsGenerating(false);
      }
    } catch { setIsGenerating(false); }
  }

  function handleImageChange(image: ProductImage) {
    setSelectedImage(image);
    setLatestImage(null);
  }

  function handleAssetSave(id: string) {
    setAssetImages((prev) => {
      if (prev.some((img) => img.id === id)) return prev;
      const target = latestImage;
      if (target && target.id === id) return [...prev, target];
      return prev;
    });
  }

  async function handleBatchDownload() {
    for (const img of assetImages) {
      try {
        const res = await fetch(img.url);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `flashant-${img.id.slice(0, 8)}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch { /* skip */ }
    }
  }

  return (
    <div className="px-6 py-8 flex flex-col gap-6 h-full">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-brand-900 tracking-tight">
          {t("studio.title")}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">{t("studio.desc")}</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* ── Left panel ── */}
        <div className="w-[360px] flex-shrink-0">
          {projectCreating ? (
            <div className="flex items-center justify-center gap-2.5 h-64 text-sm text-zinc-400 bg-white rounded-xl border border-zinc-200/70">
              <Loader2 size={16} className="animate-spin text-brand-500" />
              {t("studio.preparing")}
            </div>
          ) : projectError ? (
            <div className="flex flex-col items-center justify-center gap-4 h-64 p-6 rounded-xl border border-red-200 bg-red-50">
              <AlertTriangle size={28} className="text-red-500" strokeWidth={1.5} />
              <p className="text-sm font-medium text-red-700 text-center">{projectError}</p>
              <Button variant="outline" size="sm" onClick={createProject} className="gap-1.5">
                <Plus size={14} />
                {t("studio.retry")}
              </Button>
            </div>
          ) : (
            <StudioControlPanel
              projectId={projectId}
              selectedImage={selectedImage}
              mode={mode}
              prompt={prompt}
              quantity={quantity}
              engineType={engineType}
              targetPlatform={targetPlatform}
              isGenerating={isGenerating}
              onImageChange={handleImageChange}
              onModeChange={setMode}
              onPromptChange={setPrompt}
              onQuantityChange={setQuantity}
              onEngineChange={setEngineType}
              onPlatformChange={setTargetPlatform}
              onGenerate={handleGenerate}
            />
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 min-w-0">
          <StudioPreviewCanvas
            isGenerating={isGenerating}
            latestImage={latestImage}
            assetImages={assetImages}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAssetSave={handleAssetSave}
            onBatchDownload={handleBatchDownload}
            quotaUsed={quotaUsed}
            quotaLimit={quotaLimit}
          />
        </div>
      </div>
    </div>
  );
}
