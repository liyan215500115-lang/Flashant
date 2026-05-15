"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  GENERATING: "生成中",
  GENERATED: "已生成",
  FAILED: "失败",
};

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
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProject(data.project);
      setLoading(false);
    } catch {
      setError("加载项目失败");
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

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
          setError(data.message || "额度已用完，请升级套餐");
        } else if (data.error === "already_generating") {
          // Already in progress, start polling
          startPolling(data.taskId, productImageId);
          return;
        } else {
          throw new Error(data.error || "生成失败");
        }
      } else {
        const data = await res.json();
        startPolling(data.taskId, productImageId);
        fetchProject(); // Refresh to show updated status
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请重试");
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

  if (!project || error === "加载项目失败") {
    return (
      <div className="max-w-[960px] mx-auto py-8">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6">
            <p className="text-sm text-destructive font-medium">项目未找到</p>
          </CardContent>
        </Card>
        <div className="mt-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft size={14} className="mr-1" />
              返回工作台
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
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft size={14} />
            返回工作台
          </Link>
          <h1 className="text-xl font-semibold">{project.title || "未命名"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={project.status} />
            {project.promptTemplate && (
              <span className="text-xs text-muted-foreground">
                {project.promptTemplate.nameZh || project.promptTemplate.name} · {category}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.status === "GENERATED" && (
            <Link href={`/products/${project.id}/publish`}>
              <Button variant="default" size="sm">
                发布到平台
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Product Images + Generate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {project.productImages.map((pi) => {
          const isGenerating = generatingIds.has(pi.id);
          const imageResults = succeededImages.filter(
            (img) => img.productImageId === pi.id
          );
          const hasResults = imageResults.length > 0;

          return (
            <Card key={pi.id}>
              <CardContent className="p-4">
                {/* Source Image */}
                <div
                  className="aspect-square rounded-lg mb-4 overflow-hidden"
                  style={{ background: "var(--bg)" }}
                >
                  <img
                    src={pi.originalUrl}
                    alt={pi.fileName}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Generate Button / Results */}
                {!hasResults && !isGenerating && (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleGenerate(pi.id)}
                  >
                    <Sparkles size={14} />
                    生成场景图
                  </Button>
                )}

                {!hasResults && isGenerating && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                      <RefreshCw size={12} className="animate-spin" />
                      AI 正在生成中...
                    </p>
                    <Skeleton className="h-40 rounded-lg" />
                  </div>
                )}

                {hasResults && (
                  <div>
                    {isGenerating && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <RefreshCw size={12} className="animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">更多生成中...</span>
                        </div>
                        <Skeleton className="h-32 rounded-lg" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {imageResults.map((img) => (
                        <div key={img.id} className="relative group">
                          <div
                            className="aspect-square rounded-lg overflow-hidden"
                            style={{ background: "var(--bg)" }}
                          >
                            <img
                              src={img.url}
                              alt="Generated"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={img.url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-background/90 hover:bg-background shadow-sm transition-colors"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 mt-3"
                      onClick={() => handleGenerate(pi.id)}
                      disabled={isGenerating}
                    >
                      <RefreshCw size={14} />
                      重新生成
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Empty state — no product images yet */}
        {project.productImages.length === 0 && (
          <Card className="border-dashed md:col-span-2">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Image size={40} className="text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">暂无产品图片</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  请先上传产品图片以开始生成
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completed badge */}
      {project.status === "GENERATED" && succeededImages.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-emerald-600">
          <CheckCircle2 size={16} />
          全部生成完成 — {succeededImages.length} 张商品图已就绪
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
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
