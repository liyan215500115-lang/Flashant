"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageEditor } from "@/components/project/image-editor";
import {
  ProjectDetailLoading,
  ProjectDetailView,
  type DetailShotModel,
} from "@/components/project/project-detail-view";

import {
  AlertCircle,
  ArrowLeft,
  Download,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useT } from "@/components/i18n-provider";
import { toast } from "sonner";
import { downloadBlob, downloadUrls } from "@/lib/download-image";
import { imageDeleteConfirmCopy } from "@/lib/image-delete-copy";
import { saveGeneratedImage } from "@/lib/persist-project-image";
import {
  displayForGeneratedImage,
  downloadableGeneratedSrc,
  generationCompletionBanner,
  generationStatusText,
} from "@/lib/generated-image-display";
import { projectGenerationError } from "@/lib/project-fetch-error";
import { packFailureReasonLabel } from "@/lib/generate/pack-summary";
import { packRunViewFromImages } from "@/lib/generate/pack-run-client";
import { loadProjectWithRetry } from "@/lib/project-load";
import { loadProjectQuota, PROJECT_QUOTA_LOADING, type ProjectQuotaState } from "@/lib/project-quota";
import { quotaBadgeText } from "@/lib/quota-display";


interface ProductImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

interface GeneratedImage {
  id: string;
  productImageId: string | null;
  url: string;
  s3Key?: string | null;
  status: string;
  promptUsed: string | null;
  errorMessage: string | null;
  createdAt: string;
  aiProvider?: string | null;
  modelVersion?: string | null;
  generationMeta?: unknown;
}

interface Task {
  id: string;
  status: string;
  predictionId: string | null;
  errorMessage: string | null;
  productImageId: string;
  createdAt: string;
}

interface Project {
  id: string;
  title: string;
  status: string;
  errorMessage: string | null;
  productImages: ProductImage[];
  generatedImages: GeneratedImage[];
  promptTemplate: { id: string; name: string; nameZh: string; category: string } | null;
  tasks: Task[];
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [quota, setQuota] = useState<ProjectQuotaState>(PROJECT_QUOTA_LOADING);
  const quotaRequest = useRef(0);
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingImage, setEditingImage] = useState<{ url: string; name: string; productImageId: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [trackedProjectId, setTrackedProjectId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [textEditImg, setTextEditImg] = useState<{url:string; id:string} | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textSaving, setTextSaving] = useState(false);
  const [imageDeleteTarget, setImageDeleteTarget] = useState<
    { kind: "batch" } | { kind: "single"; imageId: string; removesDerivatives: boolean } | null
  >(null);
  const [imageDeleting, setImageDeleting] = useState(false);
  const router = useRouter();
  const { t, locale } = useT();
  const projectRef = useRef<Project | null>(null);

  function fill(key: string, vars: Record<string, string | number>) {
    return Object.entries(vars).reduce(
      (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
      t(key),
    );
  }

  function rememberBroken(id: string) {
    setBrokenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function rememberLoaded(id: string) {
    setLoadedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  const fetchProject = useCallback(async () => {
    const loaded = await loadProjectWithRetry({
      hasVisibleProject: () => Boolean(projectRef.current),
      fetchProject: async () => {
        const res = await fetch(`/api/products/${params.id}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (!data?.project?.id) return null;
        return data.project as Project;
      },
    });
    if (loaded.ok) {
      projectRef.current = loaded.project;
      setProject(loaded.project);
      setError(projectGenerationError(loaded.project, t("error.generateFailed"), locale));
      setLoading(false);
      return;
    }
    if (!loaded.keepVisible) {
      setError(t("error.loadFailed"));
      setLoading(false);
    }
  }, [params.id, locale, t]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const refreshQuota = useCallback(() => {
    const request = quotaRequest.current + 1;
    quotaRequest.current = request;
    setQuota((current) => (current.status === "ready" ? current : PROJECT_QUOTA_LOADING));
    void loadProjectQuota(async () => {
      const res = await fetch("/api/quota");
      if (!res.ok) throw new Error("quota");
      return res.json();
    }).then((next) => {
      if (quotaRequest.current === request) setQuota(next);
    });
  }, []);

  // A failed or unrecognized quota payload ends loading. It is not left on "…".
  useEffect(() => {
    refreshQuota();
  }, [refreshQuota, project?.id]);

  // Resume polling for in-progress tasks on mount
  useEffect(() => {
    if (!project?.tasks) return;
    project.tasks.forEach((task) => {
      if (task.status === "PENDING" || task.status === "PROCESSING") {
        startPolling(task.id, task.productImageId);
      }
    });
  }, [project?.tasks]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function startPolling(taskId: string, productImageId: string) {
    setGeneratingIds((prev) => new Set(prev).add(productImageId));

    async function poll() {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();

        if (data.task.status === "SUCCEEDED" || data.task.status === "FAILED") {
          if (data.task.status === "FAILED") {
            const raw = typeof data.task.errorMessage === "string" ? data.task.errorMessage.trim() : "";
            const detail = raw ? packFailureReasonLabel(raw, locale) : "";
            const message = detail
              ? `${t("error.generateFailed")}: ${detail}`
              : t("error.generateFailed");
            setError(message);
            toast.error(message);
          }
          setGeneratingIds((prev) => {
            const next = new Set(prev);
            next.delete(productImageId);
            return next;
          });
          pollTimers.current.delete(taskId);
          fetchProject(); // Refresh full project data
        } else if (data.poll) {
          // Continue polling
          pollTimers.current.set(
            taskId,
            setTimeout(poll, data.nextPollMs ?? 3000)
          );
        }
      } catch {
        // Retry on network error
        pollTimers.current.set(taskId, setTimeout(poll, 5000));
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          next.delete(productImageId);
          return next;
        });
        pollTimers.current.delete(taskId);
      }
    }

    const initialDelay = project?.tasks?.find((t) => t.id === taskId)?.status === "PENDING" ? 2000 : 5000;
    pollTimers.current.set(taskId, setTimeout(poll, initialDelay));
  }

  async function confirmImageDelete() {
    if (!imageDeleteTarget || imageDeleting) return;
    const ids = imageDeleteTarget.kind === "batch" ? [...selectedIds] : [imageDeleteTarget.imageId];
    if (ids.length === 0) return;
    setImageDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/products/${params.id}/images`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageId: id }),
          });
          if (!res.ok) throw new Error("delete failed");
        })
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) toast.error(fill("detail.deleteSomeFailed", { count: failed }));
      else toast.success(ids.length > 1 ? fill("detail.deletedMany", { count: ids.length }) : t("detail.deletedOne"));
      if (imageDeleteTarget.kind === "batch") setSelectedIds(new Set());
      setImageDeleteTarget(null);
      fetchProject();
      refreshQuota();
    } finally {
      setImageDeleting(false);
    }
  }

  async function handleEditorSave(_url: string, blob: Blob) {
    if (!project || !editingImage) return;
    const base = editingImage.name.replace(/\.[^.]+$/, "") || "image";
    try {
      await saveGeneratedImage(project.id, blob, {
        fileName: `${base}-edited.png`,
        productImageId: editingImage.productImageId || project.productImages[0]?.id || null,
        promptUsed: "manual-edit",
      });
      toast.success(t("detail.savedToProject"));
      setEditingImage(null);
      await fetchProject();
    } catch (error) {
      toast.error(t("detail.saveFailed"));
      throw error;
    }
  }

  async function handleAddText() {
    if (!project || !textEditImg || !textInput.trim() || textSaving) return;
    setTextSaving(true);
    try {
      const blob = await renderTextOverlay(textEditImg.url, textInput.trim());
      const source = project.generatedImages.find((img) => img.id === textEditImg.id);
      await saveGeneratedImage(project.id, blob, {
        fileName: "image-text.png",
        productImageId: source?.productImageId || project.productImages[0]?.id || null,
        promptUsed: "text-overlay",
      });
      downloadBlob(blob, "image-text.png");
      toast.success(t("detail.savedAndDownloading"));
      setTextEditImg(null);
      setTextInput("");
      await fetchProject();
    } catch {
      toast.error(t("detail.saveFailed"));
    } finally {
      setTextSaving(false);
    }
  }

  async function handleRegenerateImage(promptUsed: string, productImageId: string) {
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageProjectId: project!.id, productImageId, prompt: promptUsed, numOutputs: 1 }),
      });
      if (res.ok) {
        toast.success(t("detail.regenerating"));
        fetchProject();
      }
    } catch {}
  }

    async function handleReorder(dragId: string, dropId: string) {
    const fromIdx = succeededImages.findIndex((img) => img.id === dragId);
    const toIdx = succeededImages.findIndex((img) => img.id === dropId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const reordered = [...succeededImages];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    if (project) {
      const updated = reordered.map((img, i) => ({ ...img, createdAt: new Date(Date.now() - (reordered.length - i) * 1000).toISOString() }));
      const allImages = project.generatedImages.map(g => updated.find(u => u.id === g.id) || g);
      setProject({ ...project, generatedImages: allImages });
    }
    const order = reordered.map((img) => img.id);
    try {
      await fetch(`/api/products/${params.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) });
    } catch {}
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/products/${params.id}`, { method: "DELETE" });
      router.push("/projects");
    } catch {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  const quotaModel = {
    status: quota.status,
    value: quota.status === "error"
      ? ""
      : quotaBadgeText({
          used: quota.status === "ready" ? quota.used : 0,
          limit: quota.status === "ready" ? quota.limit : 0,
          tier: quota.tier,
          allotmentConfigured: quota.allotmentConfigured,
          loading: quota.status !== "ready",
        }, t("generate.unlimited")),
    exhausted: quota.status === "ready" && quota.limit > 0 && quota.used >= quota.limit,
    onRetry: refreshQuota,
  };

  if (loading) {
    return <ProjectDetailLoading quota={quotaModel} />;
  }

  if (!project || error === t("error.loadFailed")) {
    return (
      <div className="project-detail">
        <div className="pd-canvas">
          <Link href="/projects" className="pd-back" data-testid="back-to-projects">
            <span className="pd-back-icon" aria-hidden="true">
              <ArrowLeft size={16} strokeWidth={2} />
            </span>
            {t("sidebar.products")}
          </Link>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <p className="text-sm text-destructive font-medium">{t("detail.projectNotFound")}</p>
            </CardContent>
          </Card>
          <div className="mt-4">
            <Link href="/projects" className="pd-btn pd-btn-outline">
              <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
              {t("detail.backToWorkspace")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (project.id !== trackedProjectId) {
    setTrackedProjectId(project.id);
    setBrokenIds(new Set());
    setLoadedIds(new Set());
  }

  const succeededImages = project.generatedImages.filter(
    (img) => img.status === "SUCCEEDED"
  );
  const failedImages = project.generatedImages.filter((img) => img.status === "FAILED");
  const loadState = { loadedIds, brokenIds };
  const banner = generationCompletionBanner({
    projectStatus: project.status,
    images: project.generatedImages,
    loadedIds,
    brokenIds,
  });
  const statusText = generationStatusText(banner, t);
  const downloadableShots = succeededImages.flatMap((img) => {
    const src = downloadableGeneratedSrc(img, loadState);
    return src ? [{ img, src }] : [];
  });
  const packView = packRunViewFromImages(project.generatedImages, locale);
  const listedFailures = packView
    ? packView.failures.map((failure, index) => ({ id: `${failure.key}-${index}`, reason: failure.reason }))
    : failedImages.map((img) => ({
        id: img.id,
        reason: packFailureReasonLabel(img.errorMessage || t("error.generateFailed"), locale),
      }));
  const deleteCount = imageDeleteTarget?.kind === "batch" ? selectedIds.size : 1;
  const removesDerivatives = imageDeleteTarget?.kind === "single"
    ? imageDeleteTarget.removesDerivatives
    : imageDeleteTarget?.kind === "batch"
      ? [...selectedIds].some((id) =>
          project.productImages.some((pi) => pi.id === id) &&
          project.generatedImages.some((img) => img.productImageId === id && img.status !== "DELETED")
        )
      : false;
  const deleteCopy = imageDeleteConfirmCopy({
    count: Math.max(deleteCount, 1),
    removesDerivatives,
    t,
  });

  const shots: DetailShotModel[] = [
    ...project.productImages.map((pi) => ({
      id: pi.id,
      kind: "original" as const,
      src: pi.originalUrl,
      alt: pi.fileName,
      fileName: pi.fileName || "original",
    })),
    ...succeededImages.map((img) => {
      const display = displayForGeneratedImage(img);
      return {
        id: img.id,
        kind: "generated" as const,
        src: brokenIds.has(img.id) ? null : display.src,
        alt: "",
        fileName: `flashant-${img.id.slice(0, 8)}.png`,
      };
    }),
  ];

  const detailProject = project;

  function editShot(id: string) {
    const original = detailProject.productImages.find((pi) => pi.id === id);
    if (original) {
      setEditingImage({ url: original.originalUrl, name: original.fileName, productImageId: original.id });
      return;
    }
    const img = succeededImages.find((image) => image.id === id);
    if (!img) return;
    const src = downloadableGeneratedSrc(img, loadState) ?? displayForGeneratedImage(img).src;
    if (!src) return;
    setEditingImage({
      url: src,
      name: `flashant-${img.id.slice(0, 8)}.png`,
      productImageId: img.productImageId || detailProject.productImages[0]?.id || "",
    });
  }

  function downloadOne(id: string) {
    const img = succeededImages.find((image) => image.id === id);
    if (img) {
      const src = downloadableGeneratedSrc(img, loadState) ?? displayForGeneratedImage(img).src;
      if (!src) return;
      void downloadUrls([{ url: src, fileName: `flashant-${img.id.slice(0, 8)}.png` }]).then(({ failed }) => {
        if (failed > 0) toast.error(t("detail.downloadFailed"));
      });
      return;
    }
    const original = detailProject.productImages.find((pi) => pi.id === id);
    if (!original?.originalUrl) return;
    void downloadUrls([{
      url: original.originalUrl,
      fileName: original.fileName || `flashant-${id.slice(0, 8)}.png`,
    }]).then(({ failed }) => {
      if (failed > 0) toast.error(t("detail.downloadFailed"));
    });
  }

  function deleteShot(id: string) {
    const original = detailProject.productImages.some((pi) => pi.id === id);
    setImageDeleteTarget({
      kind: "single",
      imageId: id,
      removesDerivatives: original
        ? detailProject.generatedImages.some((img) => img.productImageId === id && img.status !== "DELETED")
        : false,
    });
  }

  const notices = (
    <>
      {error && (
        <div className="pd-alert" role="alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {statusText && banner.kind !== "complete" && (
        <div className="pd-notice is-warn" role="status">
          <AlertCircle size={16} />
          <span>{statusText}</span>
        </div>
      )}
      {packView && banner.kind !== "complete" && banner.kind !== "unavailable" && banner.kind !== "partial" && banner.kind !== "pending" && packView.failures.length > 0 && (
        <div className="pd-notice is-warn">
          <div>
            <p>{packView.summary}</p>
            <ul>
              {listedFailures.slice(0, 8).map((failure) => (
                <li key={failure.id}>{failure.reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {packView && (banner.kind === "unavailable" || banner.kind === "partial") && packView.failures.length > 0 && (
        <ul className="pd-notice is-warn">
          {listedFailures.slice(0, 8).map((failure) => (
            <li key={failure.id}>{failure.reason}</li>
          ))}
        </ul>
      )}
      {!packView && banner.failed > 0 && (
        <div className="pd-notice is-warn">
          <div>
            <p>{fill("detail.partialResult", {
              done: banner.ready,
              total: banner.ready + banner.unavailable + banner.failed + banner.pending,
              failed: banner.failed,
            })}</p>
            {banner.unavailable > 0 && (
              <p>{fill("detail.imagesUnavailable", { count: banner.unavailable })}</p>
            )}
            <ul>
              {listedFailures.slice(0, 8).map((failure) => (
                <li key={failure.id}>{failure.reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <ProjectDetailView
        projectId={project.id}
        title={project.title || t("workspace.noName")}
        shots={shots}
        originalCount={project.productImages.length}
        generatedCount={succeededImages.length}
        downloadableCount={downloadableShots.length}
        editMode={editMode}
        selectedIds={selectedIds}
        quota={quotaModel}
        generating={generatingIds.size > 0}
        onDownloadAll={() => {
          void downloadUrls(
            downloadableShots.map(({ img, src }) => ({
              url: src,
              fileName: `flashant-${img.id.slice(0, 8)}.png`,
            })),
          ).then(({ failed }) => {
            if (failed > 0) toast.error(fill("detail.downloadSomeFailed", { count: failed }));
          });
        }}
        onEnterSelect={() => setEditMode(true)}
        onExitSelect={() => {
          setEditMode(false);
          setSelectedIds(new Set());
        }}
        onDeleteProject={() => setDeleteDialogOpen(true)}
        onToggleShot={(id) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onOpenShot={(id) => {
          const shot = shots.find((item) => item.id === id);
          if (shot?.src) setLightboxUrl(shot.src);
        }}
        onEditShot={editShot}
        onDownloadShot={downloadOne}
        onDeleteShot={deleteShot}
        onAddText={() => {
          const img = succeededImages.find((image) => selectedIds.has(image.id));
          const src = img ? downloadableGeneratedSrc(img, loadState) : null;
          if (img && src) {
            setTextEditImg({ url: src, id: img.id });
            setTextInput("");
          }
        }}
        onRegenerateSelected={() => {
          for (const id of selectedIds) {
            const img = succeededImages.find((image) => image.id === id);
            const pi = project.productImages.find((item) => item.id === img?.productImageId);
            if (img && pi) void handleRegenerateImage(img.promptUsed || "", pi.id);
          }
          setSelectedIds(new Set());
        }}
        onBatchDelete={() => setImageDeleteTarget({ kind: "batch" })}
        onReorder={handleReorder}
        onDropOriginal={(payload) => setEditingImage(payload)}
        onShotLoad={(id) => {
          const img = succeededImages.find((image) => image.id === id);
          if (img && !displayForGeneratedImage(img).durable) rememberLoaded(id);
        }}
        onShotError={rememberBroken}
        footer={notices}
      />

      {lightboxUrl && !textEditImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4 cursor-pointer" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[80vh] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              const generated = project.generatedImages.find((img) => img.url === lightboxUrl || displayForGeneratedImage(img).src === lightboxUrl);
              const original = project.productImages.find((img) => img.originalUrl === lightboxUrl);
              const fileName = generated
                ? `flashant-${generated.id.slice(0, 8)}.png`
                : original?.fileName || "flashant-image.png";
              void downloadUrls([{ url: lightboxUrl, fileName }]).then(({ failed }) => {
                if (failed > 0) toast.error(t("detail.downloadFailed"));
              });
            }}
          >
            <Download size={16} />
            {t("detail.download")}
          </button>
        </div>
      )}

      {textEditImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4" onClick={() => setTextEditImg(null)}>
          <img src={textEditImg.url} alt="" className="max-w-[85vw] max-h-[70vh] rounded-xl shadow-2xl object-contain" />
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <input type="text" value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddText();
              }}
              placeholder={t("detail.textPlaceholder")}
              disabled={textSaving}
              className="w-64 h-9 rounded-lg border border-zinc-200 px-3 text-sm focus:border-brand-500 focus:outline-none" />
            <Button size="sm" className="cursor-pointer bg-brand-900 hover:bg-brand-800"
              disabled={!textInput.trim() || textSaving}
              onClick={() => { void handleAddText(); }}>
              {textSaving ? t("detail.saving") : t("detail.saveAndDownload")}
            </Button>
            <button type="button" onClick={() => setTextEditImg(null)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <Dialog open={imageDeleteTarget !== null} onOpenChange={(open) => { if (!open && !imageDeleting) setImageDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteCopy.title}</DialogTitle>
            <DialogDescription>
              {deleteCopy.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImageDeleteTarget(null)} disabled={imageDeleting} className="cursor-pointer">
              {t("detail.cancel")}
            </Button>
            <Button
              variant="destructive" size="sm"
              onClick={() => { void confirmImageDelete(); }}
              disabled={imageDeleting}
              className="cursor-pointer">
              {imageDeleting ? t("detail.deleting") : deleteCopy.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingImage && (
        <ImageEditor
          imageUrl={editingImage.url}
          fileName={editingImage.name}
          onSave={handleEditorSave}
          onClose={() => setEditingImage(null)}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detail.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("detail.confirmDeleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              className="cursor-pointer"
            >
              {t("detail.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="cursor-pointer"
            >
              {deleting ? t("detail.deleting") : t("detail.confirmDeleteBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function renderTextOverlay(imageUrl: string, text: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const fontSize = Math.max(24, Math.floor(img.width / 20));
      ctx.font = `700 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "center";
      ctx.fillText(text, img.width / 2, img.height / 2 + fontSize * 0.3);
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error("blob"));
        else resolve(blob);
      }, "image/png");
    };
    img.onerror = () => reject(new Error("image"));
    img.src = imageUrl;
  });
}
