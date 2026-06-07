"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioControlPanel } from "@/components/studio/control-panel";
import { StudioPreviewCanvas } from "@/components/studio/preview-canvas";
import { useT } from "@/components/i18n-provider";
import { PLATFORM_SPECS } from "@/lib/platform-specs";
import { toast } from "sonner";

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
  const [productName, setProductName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState(4);
  const [engineType, setEngineType] = useState("flux");
  const [targetPlatform, setTargetPlatform] = useState("SHOPIFY");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [brandPresetId, setBrandPresetId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  const [latestImage, setLatestImage] = useState<PreviewImage | null>(null);
  const [generationHistory, setGenerationHistory] = useState<PreviewImage[]>([]);
  const [assetImages, setAssetImages] = useState<PreviewImage[]>([]);
  const [activeTab, setActiveTab] = useState("main");

  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(-1);

  // Detail: tracking
  const [detailGen, setDetailGen] = useState<Record<string,boolean>>({});

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
            const preview = { id: data.result.id, url: data.result.url, promptUsed: prompt };
            setLatestImage(preview);
            setGenerationHistory((prev) => {
              const next = [preview, ...prev.filter((h) => h.id !== preview.id)];
              return next.slice(0, 12);
            });
            setIsGenerating(false);
            toast.success(t("generate.success"));
            fetch("/api/quota").then((r) => r.json()).then((d) => setQuotaUsed(d.used ?? 0)).catch(() => {});
            return;
          }
          if (data.task?.status === "FAILED") {
            setGenerationError(data.task.errorMessage || t("error.generateFailed"));
            toast.error(data.task.errorMessage || t("error.generateFailed"));
            setIsGenerating(false);
            return;
          }
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
    setGenerationError("");

    const count = Math.min(quantity || 1, 4);
    for (let i = 0; i < count; i++) {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageProjectId: projectId,
            productImageId: selectedImage.id,
            prompt: prompt || undefined,
            numOutputs: 1,
            engineType,
            targetPlatform,
            targetLanguage,
            brandPresetId: brandPresetId || undefined,
        }),
      });
        const data = await res.json();
        if (data.status === "succeeded" && data.url) {
          const preview = { id: data.generatedImageId, url: data.url, promptUsed: prompt };
          setLatestImage(preview);
          setGenerationHistory((prev) => {
            const next = [preview, ...prev.filter((h) => h.id !== preview.id)];
            return next.slice(0, 12);
          });
        } else if (data.taskId) {
          pollTask(data.taskId);
        }
      } catch { /* retry next */ }
    }
    setIsGenerating(false);
    if (generationHistory.length > 0) {
      toast.success(`${count} image(s) generated`);
      fetch("/api/quota").then((r) => r.json()).then((d) => setQuotaUsed(d.used ?? 0)).catch(() => {});
    }
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
    <div className="max-w-[1400px] mx-auto px-8 py-6 flex flex-col gap-5 h-full">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{t("studio.title")}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{t("studio.desc")}</p>
      </div>

      <div className="flex gap-8 flex-1 min-h-0">
        {/* ── Left panel ── */}
        <div className="w-[340px] flex-shrink-0">
          {projectCreating ? (
            <div className="flex items-center justify-center gap-2.5 h-64 text-sm text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70">
              <Loader2 size={16} className="animate-spin text-brand-500" />
              {t("studio.preparing")}
            </div>
          ) : projectError ? (
            <div className="flex flex-col items-center justify-center gap-4 h-64 p-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <AlertTriangle size={28} className="text-red-500 dark:text-red-400" strokeWidth={1.5} />
              <p className="text-sm font-medium text-red-700 dark:text-red-300 text-center">{projectError}</p>
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
              targetLanguage={targetLanguage}
              brandPresetId={brandPresetId}
              isGenerating={isGenerating}
              onImageChange={handleImageChange}
              onModeChange={setMode}
              onPromptChange={setPrompt}
              onQuantityChange={setQuantity}
              onEngineChange={setEngineType}
              onPlatformChange={(p) => {
                setTargetPlatform(p);
                const spec = PLATFORM_SPECS[p];
                if (spec?.languages?.[0]) setTargetLanguage(spec.languages[0].code);
              }}
              onLanguageChange={setTargetLanguage}
              onBrandPresetChange={setBrandPresetId}
              onGenerate={handleGenerate}
            />
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <StudioPreviewCanvas
            isGenerating={isGenerating}
            latestImage={latestImage}
            generationHistory={generationHistory}
            onHistorySelect={(img) => setLatestImage(img)}
            assetImages={assetImages}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAssetSave={handleAssetSave}
            onBatchDownload={handleBatchDownload}
            quotaUsed={quotaUsed}
            quotaLimit={quotaLimit}
            generationError={generationError}
            onDismissError={() => setGenerationError("")}
          />

          {/* Detail image generation — shown after main images exist */}
          {generationHistory.length >= 1 && (
            <DetailImageGenerator projectId={projectId} productName={productName} engineType={engineType} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail image generator component ──
const DETAIL_TYPES = [
  { key: "selling_points", label: "📐 Core Selling Points", labelZh: "📐 核心卖点图", prompt: "Product key selling points infographic style, highlighted features with clean callout text, white background, e-commerce product page section, professional layout" },
  { key: "detail", label: "🔍 Detail Close-up", labelZh: "🔍 商品细节图", prompt: "Extreme macro close-up product detail shot, texture and material clearly visible, premium product photography, shallow depth of field, 8K" },
  { key: "size", label: "📏 Size Guide", labelZh: "📏 尺寸/容量图", prompt: "Product size comparison with measurement reference, dimensional guide overlay, clean studio lighting, informative layout, scale reference" },
  { key: "compare", label: "⚡ Before/After", labelZh: "⚡ 效果对比图", prompt: "Before and after comparison, split screen layout, product transformation showcase, side by side, professional presentation, dramatic improvement visible" },
  { key: "craft", label: "🛠 Craftsmanship", labelZh: "🛠 工艺制作图", prompt: "Artisan craftsmanship process scene, hands carefully making the product, workshop environment, warm natural lighting, authentic handmade feel, documentary style" },
  { key: "series", label: "📦 Series Collection", labelZh: "📦 系列展示图", prompt: "Product family lineup, multiple color variants or styles displayed together, organized grid layout, collection showcase, premium brand presentation" },
  { key: "scene", label: "🏠 Lifestyle Scene", labelZh: "🏠 场景使用图", prompt: "Product in real-life use scenario, lifestyle photography, natural environment, candid authentic moment, aspirational aesthetics, magazine quality" },
];

function DetailImageGenerator({ projectId, engineType }: { projectId: string | null; productName?: string; engineType: string }) {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  async function handleGenerateDetails() {
    if (!projectId || selectedTypes.size === 0) return;
    setGenerating(true);
    const types = DETAIL_TYPES.filter((d) => selectedTypes.has(d.key));

    for (const t of types) {
      try {
        await fetch("/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageProjectId: projectId, prompt: t.prompt, numOutputs: 1, engineType }),
        });
      } catch { /* continue */ }
    }
    setGenerating(false);
    toast.success(`${types.length} detail images queued`);
  }

  return (
    <div className="rounded-2xl border border-brand-200 dark:border-brand-700 bg-brand-50/30 dark:bg-brand-900/10 p-5">
      <h3 className="text-sm font-semibold text-brand-900 dark:text-brand-300 mb-1">📋 Generate Detail Images</h3>
      <p className="text-xs text-zinc-500 mb-3">Select content types — AI generates each as a separate image</p>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {DETAIL_TYPES.map((dt) => (
          <button key={dt.key} type="button"
            onClick={() => setSelectedTypes((prev) => { const n = new Set(prev); n.has(dt.key) ? n.delete(dt.key) : n.add(dt.key); return n; })}
            className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${selectedTypes.has(dt.key) ? "bg-brand-100 border-brand-300 text-brand-800 dark:bg-brand-900/30 dark:border-brand-600 dark:text-brand-300" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"}`}>
            {dt.label}
          </button>
        ))}
      </div>
      <button onClick={handleGenerateDetails} disabled={selectedTypes.size === 0 || generating}
        className="w-full py-2.5 rounded-xl bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 disabled:opacity-40 transition-colors cursor-pointer">
        {generating ? "Generating..." : `Generate ${selectedTypes.size || 0} Detail Images`}
      </button>
    </div>
  );
}
