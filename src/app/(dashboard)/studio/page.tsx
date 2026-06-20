"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, AlertTriangle, Loader2, ChevronRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StudioControlPanel } from "@/components/studio/control-panel";
import { StudioPreviewCanvas } from "@/components/studio/preview-canvas";
import { StudioDetailPanel } from "@/components/studio/detail-panel";
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
  const searchParams = useSearchParams();
  const existingId = searchParams.get("projectId");
  const [projectId, setProjectId] = useState<string | null>(existingId);
  const [projectCreating, setProjectCreating] = useState(false);
  const [projectError, setProjectError] = useState("");

  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [engineType, setEngineType] = useState("gemini");
  const [targetPlatform, setTargetPlatform] = useState("SHOPIFY");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [brandPresetId, setBrandPresetId] = useState<string | null>(null);
  const [styleReferenceUrl, setStyleReferenceUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  // Sync product name to project title (debounced)
  function handleProductNameChange(name: string) {
    setProductName(name);
    if (projectId && name.trim()) {
      fetch(`/api/products/${projectId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name }),
      }).catch(() => {});
    }
  }

  const [accessoryImages, setAccessoryImages] = useState<ProductImage[]>([]);
  const [latestImage, setLatestImage] = useState<PreviewImage | null>(null);
  const [generationHistory, setGenerationHistory] = useState<PreviewImage[]>([]);
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
    fetch("/api/quota")
      .then((r) => r.json())
      .then((d) => {
        setQuotaUsed(d.used ?? 0);
        setQuotaLimit(d.limit ?? -1);
      })
      .catch(() => {});
    // If we got a projectId from URL, load project + restore history. Otherwise create a new one.
    if (existingId) {
      fetch(`/api/products/${existingId}`)
        .then((r) => r.json())
        .then((d) => {
          const imgs = d.project?.productImages ?? [];
          if (imgs.length > 0) setSelectedImage(imgs[0]);
          if (d.project?.title && !d.project.title.startsWith("202")) setProductName(d.project.title);
          const gens = d.project?.generatedImages ?? [];
          if (gens.length > 0) {
            const history = gens
              .filter((g: any) => g.status === "SUCCEEDED")
              .map((g: any) => ({ id: g.id, url: g.url, promptUsed: g.promptUsed || "" }));
            if (history.length > 0) {
              setLatestImage(history[0]);
              setGenerationHistory(history);
            }
          }
        })
        .catch(() => {});
      setProjectCreating(false);
    } else {
      // Auto-create a draft project so upload works
      setProjectCreating(true);
      fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
        .then((r) => r.json())
        .then((d) => { if (d.project?.id) setProjectId(d.project.id); })
        .catch((e) => setProjectError(e.message))
        .finally(() => setProjectCreating(false));
    }
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
    if (!selectedImage || isGenerating) return;

    // Auto-create project on first generate if needed
    let pid = projectId;
    if (!pid) {
      setProjectCreating(true);
      try {
        const r = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: productName || "" }) });
        const d = await r.json();
        if (d.project?.id) { pid = d.project.id; setProjectId(pid); }
        else { setProjectError("Failed to create project"); setProjectCreating(false); return; }
      } catch (e) { setProjectError("Network error"); setProjectCreating(false); return; }
      setProjectCreating(false);
    }

    setIsGenerating(true);
    setGenerationError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: pid!,
          productImageId: selectedImage.id,
          prompt,
          title: productName,
          numOutputs: 1,
          engineType,
          targetPlatform,
          targetLanguage,
          brandPresetId: brandPresetId || undefined,
          referenceImageUrl: styleReferenceUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.status === "succeeded") {
        const urls: Array<{ id: string; url: string }> = data.urls ?? (data.url ? [{ id: data.generatedImageId, url: data.url }] : []);
        const newPreviews = urls.map((u, i) => ({ id: u.id, url: u.url, promptUsed: prompt }));
        if (newPreviews.length > 0) {
          setLatestImage(newPreviews[0]);
          setGenerationHistory((prev) => {
            const ids = new Set(newPreviews.map((p) => p.id));
            const next = [...newPreviews, ...prev.filter((h) => !ids.has(h.id))];
            return next.slice(0, 12);
          });
        }
        toast.success(`Generated ${newPreviews.length} image${newPreviews.length > 1 ? "s" : ""}`);
        fetch("/api/quota").then((r) => r.json()).then((d) => setQuotaUsed(d.used ?? 0)).catch(() => {});
      } else if (data.taskId) {
        pollTask(data.taskId);
        return; // polling manages its own setIsGenerating(false)
      } else if (data.error) {
        setGenerationError(data.message || data.error);
        toast.error(data.message || data.error);
      }
    } catch (e) {
      setGenerationError(e instanceof Error ? e.message : "Network failed");
    }
    setIsGenerating(false);
  }

  function handleImageChange(image: ProductImage) {
    setSelectedImage(image);
    setLatestImage(null);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6 flex flex-col gap-5 h-full">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{t("studio.title")}</h1>
          {projectId && (
            <Link href={`/projects/${projectId}`} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              View project →
            </Link>
          )}
        </div>
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
              prompt={prompt}
              productName={productName}
              engineType={engineType}
              targetPlatform={targetPlatform}
              targetLanguage={targetLanguage}
              brandPresetId={brandPresetId}
              isGenerating={isGenerating}
              activeStyle={activeStyle}
              onImageChange={handleImageChange}
              onAccessoryUpload={(img) => setAccessoryImages((prev) => [...prev, img])}
              accessoryImages={accessoryImages}
              onPromptChange={setPrompt}
              onProductNameChange={handleProductNameChange}
              onEngineChange={setEngineType}
              onPlatformChange={(p) => {
                setTargetPlatform(p);
                const spec = PLATFORM_SPECS[p];
                if (spec?.languages?.[0]) setTargetLanguage(spec.languages[0].code);
              }}
              onLanguageChange={setTargetLanguage}
              onBrandPresetChange={setBrandPresetId}
              onStyleChange={(key, prompt) => { setActiveStyle(key); setPrompt(prompt); }}
              onStyleReferenceChange={setStyleReferenceUrl}
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
            projectId={projectId}
            quotaUsed={quotaUsed}
            quotaLimit={quotaLimit}
            generationError={generationError}
            onDismissError={() => setGenerationError("")}
          />

          {latestImage && projectId && selectedImage && (
            <StudioDetailPanel
              projectId={projectId}
              productImageId={selectedImage.id}
              basePrompt={prompt || `Product in ${activeStyle ?? "clean"} style`}
              referenceImageUrl={latestImage.url}
              targetPlatform={targetPlatform}
            />
          )}

          {latestImage && projectId && (
            <Link href={`/projects/${projectId}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-brand-50 py-3 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">
              <FolderOpen size={16} />
              查看项目全部图片
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail image generator component ──
