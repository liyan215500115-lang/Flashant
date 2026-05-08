import { getStageIndex, getTotalStages } from "@/lib/pipeline";
import type { PipelineStatus } from "@prisma/client";

const STEP_LABELS: Record<string, string> = {
  PARSING: "解析",
  SCRIPTING: "脚本",
  GENERATING_IMAGES: "图片",
  GENERATING_VIDEO: "视频",
  GENERATING_AUDIO: "配音",
  REVIEW: "审核",
  APPROVED: "通过",
  PUBLISHING: "发布",
  PUBLISHED: "完成",
  FAILED: "失败",
};

const STEP_ICONS: Record<string, string> = {
  PARSING: "🔗",
  SCRIPTING: "📝",
  GENERATING_IMAGES: "🖼️",
  GENERATING_VIDEO: "🎬",
  GENERATING_AUDIO: "🔊",
  REVIEW: "✅",
  APPROVED: "👍",
  PUBLISHING: "📤",
  PUBLISHED: "🎉",
  FAILED: "❌",
};

interface StepProgressProps {
  status: PipelineStatus;
}

export function StepProgress({ status }: StepProgressProps) {
  const currentIdx = getStageIndex(status);
  const total = getTotalStages();
  const isFailed = status === "FAILED";

  return (
    <div className="flex items-center gap-1 py-2">
      {Array.from({ length: total }).map((_, i) => {
        const label = Object.keys(STEP_LABELS)[i] ?? "";
        const stepStatus = STATUS_ORDER[i] as PipelineStatus;

        const done = i < currentIdx;
        const active = i === currentIdx;
        const fail = isFailed && active;

        return (
          <div key={i} className="flex items-center gap-1 flex-1 last:flex-[0_0_auto]">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                background: fail ? "var(--error)" :
                  active ? "var(--accent)" :
                  done ? "var(--success)" :
                  "var(--bg)",
                color: fail || active ? "#fff" :
                  done ? "var(--success)" :
                  "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span style={{ fontSize: 12 }}>{STEP_ICONS[stepStatus] || "⏳"}</span>
              <span>{STEP_LABELS[stepStatus] || stepStatus}</span>
            </div>
            {i < total - 1 && (
              <div
                className="flex-1 h-0.5 min-w-[12px]"
                style={{ background: done ? "var(--success)" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STATUS_ORDER: PipelineStatus[] = [
  "PARSING", "SCRIPTING", "GENERATING_IMAGES", "GENERATING_VIDEO",
  "GENERATING_AUDIO", "REVIEW", "APPROVED", "PUBLISHING", "PUBLISHED",
];
