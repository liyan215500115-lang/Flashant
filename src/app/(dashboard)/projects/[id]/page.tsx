"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { StepProgress } from "@/components/pipeline/StepProgress";
import { ScriptEditor } from "@/components/pipeline/ScriptEditor";
import { ImageGallery } from "@/components/pipeline/ImageGallery";
import { VideoPreview } from "@/components/pipeline/VideoPreview";
import { AudioPreview } from "@/components/pipeline/AudioPreview";
import { ReviewPanel } from "@/components/pipeline/ReviewPanel";
import { PublishPanel } from "@/components/pipeline/PublishPanel";
import type { ScriptGenerationResult } from "@/lib/ai/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Project = Record<string, any> & {
  id: string;
  productUrl: string;
  productTitle: string;
  productImage: string;
  status: string;
  stageProgress: number;
  estimatedRemaining: number;
  errorMessage: string | null;
  outputUrl: string | null;
  script: ScriptGenerationResult | null;
  mediaAssets: Record<string, unknown>[];
  publishRecords: Record<string, unknown>[];
};

const STATUS_LABELS: Record<string, string> = {
  PARSING: "解析中",
  SCRIPTING: "脚本生成中",
  GENERATING_IMAGES: "图片生成中",
  GENERATING_VIDEO: "视频生成中",
  GENERATING_AUDIO: "音频合成中",
  REVIEW: "待审核",
  APPROVED: "已审核",
  PUBLISHING: "发布中",
  PUBLISHED: "已发布",
  FAILED: "失败",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  if (status === "FAILED") return <Badge variant="destructive">{label}</Badge>;
  if (status === "PUBLISHED") return <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">{label}</Badge>;
  if (status === "REVIEW" || status === "APPROVED") return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="default">{label}</Badge>;
}

export default function PipelinePage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProject(data);
      setLoading(false);
      return data;
    } catch {
      setError("加载项目失败");
      setLoading(false);
      return null;
    }
  }, [params.id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Auto-trigger parsing
  useEffect(() => {
    if (!project || project.status !== "PARSING") return;
    triggerStage("parse");
  }, [project?.status]);

  // Poll during automated stages
  useEffect(() => {
    if (!project) return;
    const pollingStages = ["PUBLISHING"];
    if (!pollingStages.includes(project.status)) return;

    const interval = setInterval(fetchProject, 2000);
    return () => clearInterval(interval);
  }, [project?.status, fetchProject]);

  async function triggerStage(stage: string) {
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${params.id}/${stage}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "操作失败");
      }
      const updated = await res.json();
      setProject(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="rounded-full h-14 w-14" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project || error) {
    return (
      <div className="max-w-[960px] mx-auto py-8">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6">
            <p className="text-sm text-destructive font-medium">{error || "项目未找到"}</p>
          </CardContent>
        </Card>
        <div className="mt-4">
          <Link href="/projects">
            <Button variant="outline" size="sm">← 返回列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  const images = project.mediaAssets?.filter((a) => a.type === "IMAGE") ?? [];
  const videos = project.mediaAssets?.filter((a) => a.type === "VIDEO") ?? [];
  const audio = project.mediaAssets?.find((a) => a.type === "AUDIO");

  return (
    <div className="max-w-[960px] mx-auto flex flex-col gap-6">
      {/* Back link */}
      <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        ← 返回项目列表
      </Link>

      {/* Status Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">{project.productTitle || "未命名"}</h1>
              <StatusBadge status={project.status} />
            </div>
            <span className="text-sm text-muted-foreground">⏱ 预计剩余 {project.estimatedRemaining}s</span>
          </div>

          <StepProgress status={project.status as never} />

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">
              {project.status === "FAILED" ? "流程已终止" :
               project.status === "PUBLISHED" ? "流程已完成" :
               "流程进行中"}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{project.stageProgress}%</span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ---- Stage: Parsing ---- */}
      {project.status === "PARSING" && (
        <StageLoadingCard title="正在分析商品图片" description="AI 正在识别商品信息..." />
      )}

      {/* ---- Stage: Scripting ---- */}
      {project.status === "SCRIPTING" && !project.script?.scenes && (
        <StageLoadingCard title="AI 正在生成脚本" description="Claude 正在分析商品并生成分镜脚本...">
          <Button variant="default" onClick={() => triggerStage("script")} disabled={actionLoading}>
            {actionLoading ? "生成中..." : "开始生成脚本"}
          </Button>
        </StageLoadingCard>
      )}

      {project.script?.scenes && (project.status === "SCRIPTING" || project.status === "GENERATING_IMAGES") && (
        <ScriptEditor
          script={project.script}
          onApprove={() => triggerStage("images")}
          onRegenerate={() => triggerStage("script")}
          loading={actionLoading}
        />
      )}

      {/* ---- Stage: Generating Images ---- */}
      {project.status === "GENERATING_IMAGES" && !images.length && (
        <StageLoadingCard title="AI 正在生成图片" description="正在根据分镜描述生成场景图片..." />
      )}

      {images.length > 0 && (project.status === "GENERATING_IMAGES" || project.status === "GENERATING_VIDEO") && (
        <ImageGallery
          images={images as unknown as { id: string; url: string; stageIndex: number; aiProvider: string | null }[]}
          scenes={project.script?.scenes as { index: number; description: string; imagePrompt: string }[] | undefined}
          onContinue={() => triggerStage("video")}
          onRegenerate={() => triggerStage("images")}
          loading={actionLoading}
        />
      )}

      {/* ---- Stage: Generating Video ---- */}
      {project.status === "GENERATING_VIDEO" && !videos.length && (
        <StageLoadingCard title="AI 正在生成视频" description="正在将图片转换为动态视频片段..." />
      )}

      {videos.length > 0 && (project.status === "GENERATING_VIDEO" || project.status === "GENERATING_AUDIO") && (
        <VideoPreview
          videos={videos as unknown as { id: string; url: string; stageIndex: number; aiProvider: string | null }[]}
          onContinue={() => triggerStage("audio")}
          onRegenerate={() => triggerStage("video")}
          loading={actionLoading}
        />
      )}

      {/* ---- Stage: Generating Audio ---- */}
      {project.status === "GENERATING_AUDIO" && (
        <StageLoadingCard title="AI 正在合成配音" description="正在根据脚本文本生成语音配音...">
          <Button variant="default" onClick={() => triggerStage("audio")} disabled={actionLoading}>
            {actionLoading ? "合成中..." : "开始合成配音"}
          </Button>
        </StageLoadingCard>
      )}

      {/* ---- Stage: Review ---- */}
      {(project.status === "REVIEW" || project.status === "APPROVED") && project.script && (
        <ReviewPanel
          script={project.script}
          images={images as unknown as { id: string; url: string; stageIndex: number; aiProvider: string | null }[]}
          videos={videos as unknown as { id: string; url: string; stageIndex: number; aiProvider: string | null }[]}
          audio={audio as unknown as { id: string; url: string; stageIndex: number; aiProvider: string | null } | undefined}
          onApprove={() => triggerStage("publish")}
          onReject={async () => {
            await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
            window.location.href = "/projects";
          }}
          loading={actionLoading}
        />
      )}

      {/* ---- Stage: Publishing/Publish ---- */}
      {(project.status === "PUBLISHING" || project.status === "PUBLISHED") && (
        <PublishPanel
          records={project.publishRecords as unknown as { id: string; platform: string; status: string; platformPostUrl: string | null; errorMessage: string | null }[]}
          onPublish={() => triggerStage("publish")}
          loading={actionLoading}
        />
      )}

      {/* ---- Stage: Failed ---- */}
      {project.status === "FAILED" && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <span className="text-2xl">❌</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold">执行失败</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {project.errorMessage || "未知错误"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/projects">
                <Button variant="outline">返回列表</Button>
              </Link>
              <Button
                variant="default"
                onClick={() => {
                  window.location.href = `/projects/new?retry=${project.id}`;
                }}
              >
                🔄 重新创建
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StageLoadingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="relative">
          <Skeleton className="rounded-full h-14 w-14" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl animate-pulse">⏳</span>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {children && <div className="mt-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
