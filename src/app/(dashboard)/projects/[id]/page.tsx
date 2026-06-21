"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ImageEditor } from "@/components/project/image-editor";

import {
  ArrowLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Image,
  Trash2,
  Type,
  X,
  Check,
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
  const [editingImage, setEditingImage] = useState<{url:string; name:string} | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [textEditImg, setTextEditImg] = useState<{url:string; id:string} | null>(null);
  const [textInput, setTextInput] = useState("");
  const [deleteImagesDialogOpen, setDeleteImagesDialogOpen] = useState(false);
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

  async function handleRegenerateImage(promptUsed: string, productImageId: string) {
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageProjectId: project!.id, productImageId, prompt: promptUsed, numOutputs: 1 }),
      });
      if (res.ok) {
        toast.success("Regenerating...");
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
      setProject({ ...project, generatedImages: allImages as any });
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
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-4">
          <ArrowLeft size={14} /> {t("products.title")}
        </Link>
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
          <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-2 transition-colors">
            <ArrowLeft size={14} /> 我的项目
          </Link>
          <h1 className="text-xl font-semibold">{project.title || t("workspace.noName")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={project.status} />
            {project.promptTemplate && (
              <span className="text-xs text-muted-foreground">
                {locale === "zh" && project.promptTemplate.nameZh ? project.promptTemplate.nameZh : project.promptTemplate.name} · {category}
              </span>
            )}
          </div>
          {/* Quota badge */}
          <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mt-2 ${
            quota.limit !== Infinity && quota.used >= quota.limit
              ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
              : "bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
          }`}>
            <span className="font-mono tabular-nums">{quota.used}/{quota.limit === Infinity ? "∞" : quota.limit}</span>
            <span className="opacity-60 ml-0.5">额度</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0 ? `已选 ${selectedIds.size} 张` : "点击图片选择"}
              </span>
              <Button
                variant="outline" size="sm" className="cursor-pointer gap-1"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const first = [...selectedIds][0];
                  const img = succeededImages.find(i => i.id === first);
                  if (img) { setTextEditImg({url: img.url, id: img.id}); setTextInput(""); }
                }}>
                <Type size={14} />加文字
              </Button>
              <Button
                variant="outline" size="sm" className="cursor-pointer gap-1"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  for (const id of selectedIds) {
                    const img = succeededImages.find(i => i.id === id);
                    const pi = project.productImages.find(p => p.id === img?.productImageId);
                    if (img && pi) handleRegenerateImage(img.promptUsed || "", pi.id);
                  }
                  setSelectedIds(new Set());
                }}>
                <Sparkles size={14} />重生成
              </Button>
              <Button
                variant="outline" size="sm" className="cursor-pointer gap-1 text-zinc-500 hover:text-red-600 hover:border-red-200"
                disabled={selectedIds.size === 0}
                onClick={() => setDeleteImagesDialogOpen(true)}>
                <Trash2 size={14} />删除
              </Button>
              <Button variant="default" size="sm" className="cursor-pointer" onClick={() => { setEditMode(false); setSelectedIds(new Set()); }}>
                完成
              </Button>
            </>
          ) : (
            <>
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
                  AI 编辑
                </Button>
              </Link>
              <Button
                variant="outline" size="sm"
                onClick={() => setEditMode(true)}
                className="cursor-pointer gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                选择图片
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 cursor-pointer"
              >
                <Trash2 size={14} />
                {t("detail.delete")}
              </Button>
            </>
          )}
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
              <div className="w-full md:w-[280px] flex-shrink-0 relative group">
                <div className={`aspect-square rounded-xl overflow-hidden bg-muted border-2 transition-all ${
                  editMode && selectedIds.has(pi.id) ? "border-brand-500 ring-2 ring-brand-500" : "border-zinc-200"
                } cursor-pointer`}
                  draggable={!editMode}
                  onDragStart={(e) => { if (editMode) return; e.dataTransfer.setData("source", "product"); e.dataTransfer.setData("url", pi.originalUrl); e.dataTransfer.setData("name", pi.fileName); }}
                  onClick={() => {
                    if (editMode) {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(pi.id)) next.delete(pi.id); else next.add(pi.id);
                        return next;
                      });
                    } else {
                      setLightboxUrl(pi.originalUrl);
                    }
                  }}>
                  <img src={pi.originalUrl} alt={pi.fileName} className="w-full h-full object-cover pointer-events-none"
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.onerror = null;
                      t.style.display = "none";
                      const placeholder = document.createElement("div");
                      placeholder.className = "w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800";
                      placeholder.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                      t.parentElement?.appendChild(placeholder);
                    }} />
                </div>
                {/* Edit mode checkbox */}
                {editMode && (
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedIds.has(pi.id) ? "bg-brand-500 border-brand-500" : "bg-white/80 border-zinc-300"
                  }`}>
                    {selectedIds.has(pi.id) && <Check size={12} className="text-white" />}
                  </div>
                )}
                {/* Hover delete icon */}
                {!editMode && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm("删除这张产品图？相关的生成图也会被删除。")) handleDeleteImage(pi.id); }}
                    className="absolute top-2 left-2 p-1 rounded-md bg-white/80 hover:bg-red-50 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                    <Trash2 size={12} />
                  </button>
                )}
                {!editMode && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setEditingImage({ url: pi.originalUrl, name: pi.fileName }); }}
                    className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-white/90 hover:bg-white shadow-sm text-[10px] font-medium text-zinc-600 hover:text-zinc-800 transition-all flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    编辑
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {imageResults.length === 0 ? (
                  <Button variant="default" size="sm" className="gap-2" onClick={() => handleGenerate(pi.id)} disabled={generatingIds.has(pi.id)}>
                    <Sparkles size={14} /> {t("detail.generateScene")}
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {imageResults.map((img) => (
                      <div key={img.id}
                        draggable={!editMode}
                        onDragStart={(e) => {
                          if (editMode) return;
                          e.dataTransfer.setData("source", "generated");
                          e.dataTransfer.setData("id", img.id);
                        }}
                        onDragOver={(e) => { if (!editMode) e.preventDefault(); }}
                        onDrop={(e) => {
                          if (editMode) return;
                          e.preventDefault();
                          const src = e.dataTransfer.getData("source");
                          if (src === "generated") {
                            handleReorder(e.dataTransfer.getData("id"), img.id);
                          }
                          if (src === "product") {
                            setEditingImage({ url: e.dataTransfer.getData("url"), name: e.dataTransfer.getData("name") });
                          }
                        }}
                        className={`relative group w-[160px] h-[160px] rounded-lg overflow-hidden bg-muted border-2 border-zinc-200 ${
                          editMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                        } transition-all ${
                          editMode && selectedIds.has(img.id) ? "ring-2 ring-brand-500 border-brand-500" : ""
                        }`}
                        onClick={() => {
                          if (editMode) {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(img.id)) next.delete(img.id); else next.add(img.id);
                              return next;
                            });
                          } else {
                            setLightboxUrl(img.url);
                          }
                        }}>
                        <img src={img.url} alt="" className="w-full h-full object-cover pointer-events-none"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.onerror = null;
                    t.style.display = "none";
                    const placeholder = document.createElement("div");
                    placeholder.className = "w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800";
                    placeholder.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                    t.parentElement?.appendChild(placeholder);
                  }} />
                        {/* Hover delete icon */}
                        {!editMode && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm("删除这张图片？")) handleDeleteImage(img.id); }}
                            className="absolute top-2 left-2 p-1 rounded-md bg-white/80 hover:bg-red-50 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10">
                            <Trash2 size={12} />
                          </button>
                        )}
                        {editMode && (
                          <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selectedIds.has(img.id)
                              ? "bg-brand-500 border-brand-500"
                              : "bg-white/80 border-zinc-300"
                          }`}>
                            {selectedIds.has(img.id) && <Check size={12} className="text-white" />}
                          </div>
                        )}
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

      {/* Lightbox */}
      {lightboxUrl && !textEditImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl"
            onError={(e) => {
              const t = e.currentTarget;
              t.onerror = null;
              t.style.display = "none";
            }} />
        </div>
      )}

      {/* Text Edit Lightbox */}
      {textEditImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4" onClick={() => setTextEditImg(null)}>
          <img src={textEditImg.url} alt="" className="max-w-[85vw] max-h-[70vh] rounded-xl shadow-2xl object-contain"
            onError={(e) => { const t = e.currentTarget; t.onerror = null; t.style.display = "none"; }} />
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 shadow-xl" onClick={e => e.stopPropagation()}>
            <input type="text" value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const i = document.createElement("img"); i.crossOrigin = "anonymous";
                  i.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = i.width; canvas.height = i.height;
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(i, 0, 0);
                    const fs = Math.max(24, Math.floor(i.width / 20));
                    ctx.font = `700 ${fs}px Inter, sans-serif`;
                    ctx.fillStyle = "#1a1a1a";
                    ctx.textAlign = "center";
                    ctx.fillText(textInput, i.width / 2, i.height / 2 + fs * 0.3);
                    canvas.toBlob((b) => { if (b) { const url = URL.createObjectURL(b); const a = document.createElement("a"); a.href = url; a.download = "image-text.png"; a.click(); } }, "image/png");
                  };
                  i.onerror = () => {};
                  i.src = textEditImg.url;
                }
              }}
              placeholder="输入文字后按回车下载..."
              className="w-64 h-9 rounded-lg border border-zinc-200 px-3 text-sm focus:border-brand-500 focus:outline-none" />
            <Button size="sm" className="cursor-pointer bg-brand-900 hover:bg-brand-800"
              onClick={async () => {
                if (!textInput) return;
                const i = document.createElement("img"); i.crossOrigin = "anonymous";
                i.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = i.width; canvas.height = i.height;
                  const ctx = canvas.getContext("2d")!;
                  ctx.drawImage(i, 0, 0);
                  const fs = Math.max(24, Math.floor(i.width / 20));
                  ctx.font = `700 ${fs}px Inter, sans-serif`;
                  ctx.fillStyle = "#1a1a1a";
                  ctx.textAlign = "center";
                  ctx.fillText(textInput, i.width / 2, i.height / 2 + fs * 0.3);
                  canvas.toBlob((b) => { if (b) { const url = URL.createObjectURL(b); const a = document.createElement("a"); a.href = url; a.download = "image-text.png"; a.click(); } }, "image/png");
                };
                i.onerror = () => {};
                i.src = textEditImg.url;
              }}>
              下载
            </Button>
            <button onClick={() => setTextEditImg(null)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Batch delete confirmation dialog */}
      <Dialog open={deleteImagesDialogOpen} onOpenChange={setDeleteImagesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除选中图片</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedIds.size} 张图片吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteImagesDialogOpen(false)} className="cursor-pointer">
              取消
            </Button>
            <Button
              variant="destructive" size="sm"
              onClick={async () => {
                const results = await Promise.allSettled(
                  [...selectedIds].map(id =>
                    fetch(`/api/products/${params.id}/images`, {
                      method: "DELETE", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageId: id })
                    })
                  )
                );
                const failed = results.filter(r => r.status === "rejected").length;
                if (failed > 0) toast.error(`${failed} 张删除失败，请重试`);
                else toast.success(`已删除 ${selectedIds.size} 张图片`);
                setSelectedIds(new Set());
                setDeleteImagesDialogOpen(false);
                fetchProject();
              }}
              className="cursor-pointer">
              删除 {selectedIds.size} 张
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Editor */}
      {editingImage && (
        <ImageEditor
          imageUrl={editingImage.url}
          fileName={editingImage.name}
          onSave={(newUrl) => { setEditingImage(null); }}
          onClose={() => setEditingImage(null)}
        />
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
