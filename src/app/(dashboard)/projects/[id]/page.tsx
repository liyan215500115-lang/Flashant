"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

import {
  ArrowLeft,
  Sparkles,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Image,
  Trash2,
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
import { Breadcrumb } from "@/components/ui/breadcrumb";

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
  status: string;
  promptUsed: string | null;
  errorMessage: string | null;
  createdAt: string;
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
  const [quota, setQuota] = useState({ used: 0, limit: 200 });
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { t, locale } = useT();

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProject(data.project);
      setLoading(false);
    } catch {
      setError(t("error.loadFailed"));
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Fetch quota
  useEffect(() => {
    fetch("/api/quota")
      .then((res) => res.json())
      .then((data) => {
        if (data.used !== undefined) {
          setQuota({ used: data.used, limit: data.limit === -1 ? Infinity : data.limit });
        }
      })
      .catch(() => {});
  }, [project?.id]);

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

  async function handleGenerateExtended(params: {
    productImageId: string;
    prompt?: string;
    numOutputs?: number;
    engineType?: string;
  }) {
    const { productImageId, prompt, numOutputs, engineType } = params;
    if (generatingIds.has(productImageId)) return;
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: project!.id,
          productImageId,
          promptTemplateId: project!.promptTemplate?.id ?? null,
          prompt: prompt ?? undefined,
          numOutputs: numOutputs ?? undefined,
          engineType: engineType ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "quota_exceeded") {
          setError(data.message || t("error.quotaExceeded"));
        } else if (data.error === "already_generating") {
          startPolling(data.taskId, productImageId);
          return;
        } else {
          throw new Error(data.error || t("error.generateFailed"));
        }
      } else {
        const data = await res.json();
        startPolling(data.taskId, productImageId);
        fetchProject();
        // Refresh quota after generation
        fetch("/api/quota")
          .then((res) => res.json())
          .then((data) => {
            if (data.used !== undefined) {
              setQuota({ used: data.used, limit: data.limit === -1 ? Infinity : data.limit });
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.generateFailed"));
    }
  }

  async function handleGenerate(productImageId: string) {
    if (generatingIds.has(productImageId)) return;
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: project!.id,
          productImageId,
          promptTemplateId: project!.promptTemplate?.id ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "quota_exceeded") {
          setError(data.message || t("error.quotaExceeded"));
        } else if (data.error === "already_generating") {
          // Already in progress, start polling
          startPolling(data.taskId, productImageId);
          return;
        } else {
          throw new Error(data.error || t("error.generateFailed"));
        }
      } else {
        const data = await res.json();
        startPolling(data.taskId, productImageId);
        fetchProject(); // Refresh to show updated status
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.generateFailed"));
    }
  }

  async function handleDeleteImage(imageId: string) {
    try {
      await fetch(`/api/products/${params.id}/images`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId }) });
      fetchProject();
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

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!project || error === t("error.loadFailed")) {
    return (
      <div className="max-w-[960px] mx-auto py-8">
        <Breadcrumb items={[{ label: t("products.title"), href: "/products" }]} />
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6">
            <p className="text-sm text-destructive font-medium">{t("detail.projectNotFound")}</p>
          </CardContent>
        </Card>
        <div className="mt-4">
          <Link href="/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft size={14} className="mr-1" />
              {t("detail.backToWorkspace")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const category = project.promptTemplate?.category ?? "general";
  const succeededImages = project.generatedImages.filter(
    (img) => img.status === "SUCCEEDED"
  );

  return (
    <div className="max-w-[960px] mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb items={[
            { label: t("products.title"), href: "/products" },
            { label: project.title || t("workspace.noName") },
          ]} />
          <h1 className="text-xl font-semibold">{project.title || t("workspace.noName")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={project.status} />
            {project.promptTemplate && (
              <span className="text-xs text-muted-foreground">
                {locale === "zh" && project.promptTemplate.nameZh ? project.promptTemplate.nameZh : project.promptTemplate.name} · {category}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.status === "GENERATED" && (
            <Link href={`/projects/${project.id}/publish`}>
              <Button variant="default" size="sm" className="cursor-pointer">
                {t("detail.publishToPlatform")}
              </Button>
            </Link>
          )}
          <Link href={`/studio?projectId=${project.id}`}>
            <Button variant="outline" size="sm" className="cursor-pointer gap-1.5">
              <Sparkles size={14} />
              {locale === "zh" ? "继续编辑" : "Edit"}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 cursor-pointer"
          >
            <Trash2 size={14} />
            {t("detail.delete")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {project.productImages.map((pi) => {
          const imageResults = succeededImages.filter((img) => img.productImageId === pi.id);
          return (
            <div key={pi.id} className="flex flex-col md:flex-row gap-5 items-start">
              <div className="w-full md:w-[240px] flex-shrink-0">
                <div className="aspect-square rounded-xl overflow-hidden bg-muted border border-zinc-200">
                  <img src={pi.originalUrl} alt={pi.fileName} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {imageResults.length === 0 ? (
                  <Button variant="default" size="sm" className="gap-2" onClick={() => handleGenerate(pi.id)} disabled={generatingIds.has(pi.id)}>
                    <Sparkles size={14} /> {t("detail.generateScene")}
                  </Button>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {imageResults.map((img) => (
                      <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-zinc-200">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleDeleteImage(img.id)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-md bg-white/90 hover:bg-red-50 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {project.productImages.length === 0 && (
          <Card className="border-dashed md:col-span-2">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Image size={40} className="text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">{t("detail.noImages")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("detail.noImagesDesc")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completed badge */}
      {project.status === "GENERATED" && succeededImages.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={16} />
          {t("detail.allDone")} — {succeededImages.length} {t("detail.imagesReady")}
        </div>
      )}

      {/* Delete confirmation dialog */}
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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const label = t(`status.${status}`);
  if (status === "FAILED")
    return <Badge variant="destructive">{label}</Badge>;
  if (status === "GENERATED")
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">
        {label}
      </Badge>
    );
  if (status === "GENERATING")
    return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="default">{label}</Badge>;
}
