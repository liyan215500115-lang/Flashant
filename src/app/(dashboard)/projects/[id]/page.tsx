"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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
      <div className="max-w-[960px] mx-auto flex items-center justify-center" style={{ height: "60vh" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton rounded-full" style={{ width: 48, height: 48 }} />
          <div className="skeleton rounded-md" style={{ width: 200, height: 20 }} />
        </div>
      </div>
    );
  }

  if (!project || error) {
    return (
      <div className="max-w-[960px] mx-auto">
        <div className="error-state">{error || "项目未找到"}</div>
      </div>
    );
  }

  const images = project.mediaAssets?.filter((a) => a.type === "IMAGE") ?? [];
  const videos = project.mediaAssets?.filter((a) => a.type === "VIDEO") ?? [];
  const audio = project.mediaAssets?.find((a) => a.type === "AUDIO");

  return (
    <div className="max-w-[960px] mx-auto flex flex-col gap-6">
      <div
        className="p-4 rounded-lg border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <StepProgress status={project.status as never} />

        <div className="flex items-center justify-between mt-3">
          <div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{project.productTitle || "未命名"}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
              ⏱ 预计剩余 {project.estimatedRemaining}s
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {project.stageProgress}%
          </span>
        </div>
      </div>

      {error && <div className="error-state">{error}</div>}

      {/* Stage: Parsing */}
      {project.status === "PARSING" && (
        <div
          className="p-12 rounded-lg border text-center"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton rounded-full" style={{ width: 56, height: 56 }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>正在分析商品图片</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                AI 正在识别商品信息...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stage: Scripting */}
      {project.status === "SCRIPTING" && !project.script?.scenes && (
        <div
          className="p-12 rounded-lg border text-center"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton rounded-full" style={{ width: 56, height: 56 }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>AI 正在生成脚本</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                Claude 正在分析商品并生成分镜脚本...
              </p>
            </div>
            <button
              onClick={() => triggerStage("script")}
              disabled={actionLoading}
              className="px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-md)" }}
            >
              {actionLoading ? "生成中..." : "开始生成脚本"}
            </button>
          </div>
        </div>
      )}

      {project.script?.scenes && (project.status === "SCRIPTING" || project.status === "GENERATING_IMAGES") && (
        <ScriptEditor
          script={project.script}
          onApprove={() => triggerStage("images")}
          onRegenerate={() => triggerStage("script")}
          loading={actionLoading}
        />
      )}

      {/* Stage: Generating Images */}
      {project.status === "GENERATING_IMAGES" && !images.length && (
        <div
          className="p-12 rounded-lg border text-center"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton rounded-full" style={{ width: 56, height: 56 }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>AI 正在生成图片</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                正在根据分镜描述生成场景图片...
              </p>
            </div>
          </div>
        </div>
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

      {/* Stage: Generating Video */}
      {project.status === "GENERATING_VIDEO" && !videos.length && (
        <div
          className="p-12 rounded-lg border text-center"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton rounded-full" style={{ width: 56, height: 56 }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>AI 正在生成视频</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                正在将图片转换为动态视频片段...
              </p>
            </div>
          </div>
        </div>
      )}

      {videos.length > 0 && (project.status === "GENERATING_VIDEO" || project.status === "GENERATING_AUDIO") && (
        <VideoPreview
          videos={videos as unknown as { id: string; url: string; stageIndex: number; aiProvider: string | null }[]}
          onContinue={() => triggerStage("audio")}
          onRegenerate={() => triggerStage("video")}
          loading={actionLoading}
        />
      )}

      {/* Stage: Generating Audio */}
      {(project.status === "GENERATING_AUDIO") && (
        <div
          className="p-12 rounded-lg border text-center"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton rounded-full" style={{ width: 56, height: 56 }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>AI 正在合成配音</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                正在根据脚本文本生成语音配音...
              </p>
            </div>
            <button
              onClick={() => triggerStage("audio")}
              disabled={actionLoading}
              className="px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-md)" }}
            >
              {actionLoading ? "合成中..." : "开始合成配音"}
            </button>
          </div>
        </div>
      )}

      {/* Stage: Review */}
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

      {/* Stage: Publishing/Publish */}
      {(project.status === "PUBLISHING" || project.status === "PUBLISHED") && (
        <PublishPanel
          records={project.publishRecords as unknown as { id: string; platform: string; status: string; platformPostUrl: string | null; errorMessage: string | null }[]}
          onPublish={() => triggerStage("publish")}
          loading={actionLoading}
        />
      )}

      {/* Stage: Failed */}
      {project.status === "FAILED" && (
        <div
          className="p-8 rounded-lg border text-center"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>执行失败</h3>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
            {project.errorMessage || "未知错误"}
          </p>
          <div className="flex gap-2 justify-center">
            <a
              href="/projects"
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                background: "var(--bg)",
                color: "var(--text-primary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              返回列表
            </a>
            <button
              onClick={() => {
                window.location.href = `/projects/new?retry=${project.id}`;
              }}
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-md)" }}
            >
              🔄 重新创建
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
