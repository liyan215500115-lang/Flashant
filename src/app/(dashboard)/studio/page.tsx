"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { loadProjectWithRetry } from "@/lib/project-load";
import { restoreStudioSession, studioDetailPanelVisible } from "@/lib/studio-session";
import { refreshWorkbenchQuota, type QuotaSnapshot } from "@/lib/quota-display";
import { packWorkbenchEngine, singleImageEngineType } from "@/lib/generate/pack-engine";

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

function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export default function StudioPage() {
  const { t, locale } = useT();
  const searchParams = useSearchParams();
  const existingId = searchParams.get("projectId");
  const [projectId, setProjectId] = useState<string | null>(existingId);
  const [projectCreating, setProjectCreating] = useState(false);
  const [projectError, setProjectError] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [sourceImages, setSourceImages] = useState<ProductImage[]>([]);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [engineType, setEngineType] = useState("flux");
  const [vegaModelLabel, setVegaModelLabel] = useState("");
  const packEngineAuto = useRef(false);
  const engineTouched = useRef(false);
  const [targetPlatform, setTargetPlatform] = useState("SHOPIFY");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [brandPresetId, setBrandPresetId] = useState<string | null>(null);
  const [styleReferenceUrl, setStyleReferenceUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [loadedDetailResults, setLoadedDetailResults] = useState<Array<{key:string; url:string; label:string; rawUrl:string}>>([]);
  const [loadedDetailFailures, setLoadedDetailFailures] = useState<Array<{ key: string; reason: string }>>([]);
  const [loadedPackSummary, setLoadedPackSummary] = useState("");
  const projectVisible = useRef(false);
  const localeRef = useRef(locale);
  localeRef.current = locale;

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
  const [quotaLimit, setQuotaLimit] = useState(0);
  const [quotaTier, setQuotaTier] = useState<string | null>(null);
  const [allotmentConfigured, setAllotmentConfigured] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const quotaRef = useRef<QuotaSnapshot | null>(null);

  const refreshQuota = useCallback((reason?: "settle") => {
    const baseline = reason === "settle" ? quotaRef.current : null;
    void refreshWorkbenchQuota({
      fetchQuota: async () => {
        const response = await fetch("/api/quota");
        if (!response.ok) throw new Error("quota");
        return response.json();
      },
      apply: (quota) => {
        quotaRef.current = quota;
        setQuotaUsed(quota.used);
        setQuotaLimit(typeof quota.limit === "number" ? quota.limit : 0);
        setQuotaTier(quota.tier ?? null);
        setAllotmentConfigured(quota.allotmentConfigured === true);
        setQuotaLoading(false);
      },
      untilDiffersFrom: baseline,
    });
  }, []);

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
    fetch("/api/generate/pack-engine")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { engine?: string; modelVersion?: string | null } | null) => {
        if (cancelled || !data) return;
        const selection = packWorkbenchEngine({
          vegaConfigured: data.engine === "vega",
          providerModel: data.modelVersion,
          configuredModel: data.modelVersion,
        });
        if (selection.engine !== "vega" || !selection.label) return;
        packEngineAuto.current = true;
        if (engineTouched.current) return;
        setEngineType("vega");
        setVegaModelLabel(selection.label);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshQuota();
    if (existingId) {
      // A projectId that arrives after the first paint must still restore this
      // project. A blank draft created before that id was visible must not win.
      setProjectId(existingId);
      setProjectCreating(false);
      setProjectError("");
      projectVisible.current = false;
      setSelectedImage(null);
      setSourceImages([]);
      setLatestImage(null);
      setGenerationHistory([]);
      setLoadedDetailResults([]);
      setLoadedDetailFailures([]);
      setLoadedPackSummary("");
      void loadProjectWithRetry({
        hasVisibleProject: () => projectVisible.current,
        fetchProject: async () => {
          const response = await fetch(`/api/products/${existingId}`);
          if (!response.ok) throw new Error("Failed to fetch");
          const body = await response.json();
          if (!body?.project?.id) return null;
          return body.project;
        },
      }).then((loaded) => {
        if (cancelled) return;
        if (!loaded.ok) {
          if (!loaded.keepVisible) setProjectError("项目加载失败，请检查链接是否有效");
          return;
        }
        projectVisible.current = true;
        setProjectError("");
        const session = restoreStudioSession(loaded.project, localeRef.current);
        setProjectId(session.projectId);
        setSourceImages(session.sourceImages);
        setSelectedImage(session.selectedImage);
        if (session.productName) setProductName(session.productName);
        if (session.engine.engine === "vega") {
          setEngineType("vega");
          setVegaModelLabel(session.engine.label);
        }
        setLatestImage(session.latestImage);
        setGenerationHistory(session.generationHistory);
        setLoadedDetailResults(session.detailResults);
        setLoadedDetailFailures(session.detailFailures);
        setLoadedPackSummary(session.packSummary);
      });
      return () => {
        cancelled = true;
      };
    }

    setProjectCreating(true);
    fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.project?.id) setProjectId(d.project.id);
      })
      .catch((e) => {
        if (!cancelled) setProjectError(e.message);
      })
      .finally(() => {
        if (!cancelled) setProjectCreating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [existingId, refreshQuota]);

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
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
            refreshQuota("settle");
            return;
          }
          if (data.task?.status === "FAILED") {
            setGenerationError(data.task.errorMessage || t("error.generateFailed"));
            toast.error(data.task.errorMessage || t("error.generateFailed"));
            setIsGenerating(false);
            return;
          }
          if (data.poll) { pollTimerRef.current = setTimeout(() => { poll(); }, data.nextPollMs ?? 3000); }
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
          engineType: singleImageEngineType({
            selectedEngine: engineType,
            packEngineAutoSelected: packEngineAuto.current,
            userChoseEngine: engineTouched.current,
          }),
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
        refreshQuota("settle");
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
    if (selectedImage && selectedImage.id !== image.id) {
      setLatestImage(null);
      setGenerationHistory([]);
      setLoadedDetailResults([]);
      setLoadedDetailFailures([]);
      setLoadedPackSummary("");
    }
    setSelectedImage(image);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6 flex flex-col gap-5 h-full">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {existingId ? t("studio.editingTitle") : t("studio.title")}
          </h1>
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
              sourceImages={sourceImages}
              prompt={prompt}
              productName={productName}
              engineType={engineType}
              vegaModelLabel={vegaModelLabel}
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
              onEngineChange={(engine) => {
                engineTouched.current = true;
                packEngineAuto.current = false;
                setEngineType(engine);
              }}
              onPlatformChange={(p) => {
                setTargetPlatform(p);
                const spec = PLATFORM_SPECS[p];
                if (spec?.languages?.[0]) setTargetLanguage(spec.languages[0].code);
              }}
              onLanguageChange={setTargetLanguage}
              onBrandPresetChange={setBrandPresetId}
              onStyleChange={(key, prompt) => { setActiveStyle(key); setPrompt(prompt); }}
              onStyleReferenceChange={setStyleReferenceUrl}
              onStyleReferenceUploaded={() => {
                engineTouched.current = true;
                setEngineType("flux");
              }}
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
            quotaTier={quotaTier}
            allotmentConfigured={allotmentConfigured}
            quotaLoading={quotaLoading}
            generationError={generationError}
            onDismissError={() => setGenerationError("")}
          />

          {selectedImage && studioDetailPanelVisible({
            projectId,
            hasSelectedImage: true,
            hasLatestImage: Boolean(latestImage),
            detailResultCount: loadedDetailResults.length,
            packSummary: loadedPackSummary,
            failureCount: loadedDetailFailures.length,
          }) && (
            <StudioDetailPanel
              projectId={projectId}
              productImageId={selectedImage.id}
              basePrompt={prompt || `Product in ${activeStyle ?? "clean"} style`}
              sceneStyle={activeStyle || undefined}
              referenceImageUrl={latestImage?.url || selectedImage.originalUrl}
              referenceHasPerson={
                activeStyle === "in_use" ||
                /模特|人物|人脸|面部|手部|皮肤|佩戴|穿着|涂抹|person|people|model|face|wearing|worn/i.test(
                  `${prompt} ${latestImage?.promptUsed ?? ""}`,
                )
              }
              targetPlatform={targetPlatform}
              initialResults={loadedDetailResults}
              initialFailures={loadedDetailFailures}
              initialSummary={loadedPackSummary}
              onEngineResolved={(selection) => {
                if (selection.engine === "vega") {
                  setEngineType("vega");
                  setVegaModelLabel(selection.label);
                }
              }}
              onViewShot={(shot) => {
                setLatestImage(shot);
                setGenerationHistory((prev) => {
                  const next = [shot, ...prev.filter((item) => item.id !== shot.id || item.url !== shot.url)];
                  return next.slice(0, 12);
                });
              }}
              onPackSettled={() => {
                refreshQuota("settle");
              }}
            />
          )}

          {latestImage && projectId && (
            <Link
              href={`/projects/${projectId}${styleReferenceUrl ? `?styleRef=${encodeURIComponent(styleReferenceUrl)}&styleSeed=${Math.abs(hashStr(projectId)) % 100000}&lockStyle=1` : ""}`}
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
