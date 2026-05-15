import { Button } from "@/components/ui/button";
import type { ScriptGenerationResult } from "@/lib/ai/types";

interface AssetItem {
  id: string;
  url: string;
  stageIndex: number;
  aiProvider: string | null;
}

interface ReviewPanelProps {
  script: ScriptGenerationResult;
  images: AssetItem[];
  videos: AssetItem[];
  audio: AssetItem | undefined;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}

export function ReviewPanel({
  script,
  images,
  videos,
  audio,
  onApprove,
  onReject,
  loading,
}: ReviewPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="section-header">
        <div>
          <h2 className="section-title">审核预览</h2>
          <p className="section-subtitle">审核所有生成的素材，确认后进入发布流程</p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={onReject} disabled={loading}>
            ❌ 驳回
          </Button>
          <Button variant="default" onClick={onApprove} disabled={loading}>
            {loading ? "处理中..." : "✅ 批准并发布"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <section className="card-static p-4">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📝 脚本</h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>
            {script.voiceover}
          </p>
          <div className="flex gap-2 mt-2">
            {script.hashtags?.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                #{tag}
              </span>
            ))}
          </div>
        </section>

        <section className="card-static p-4">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🖼️ 图片 ({images.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="flex-shrink-0 rounded-lg overflow-hidden border"
                style={{ width: 120, borderColor: "var(--border)", borderRadius: "var(--radius-md)" }}
              >
                <div className="media-canvas" style={{ aspectRatio: "9/16" }}>
                  {img.url && (
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-1.5 text-center" style={{ fontSize: 11, background: "var(--surface)" }}>
                  场景 {img.stageIndex + 1}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-static p-4">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🎬 视频片段 ({videos.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {videos.map((vid) => (
              <div
                key={vid.id}
                className="flex-shrink-0 rounded-lg overflow-hidden border"
                style={{ width: 120, borderColor: "var(--border)", borderRadius: "var(--radius-md)" }}
              >
                <div className="media-canvas" style={{ aspectRatio: "9/16" }}>
                  {vid.url && (
                    <video src={vid.url} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-1.5 text-center" style={{ fontSize: 11, background: "var(--surface)" }}>
                  片段 {vid.stageIndex + 1}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-static p-4">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🔊 配音</h3>
          {audio?.url ? (
            <audio src={audio.url} controls className="w-full" />
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>暂无配音</p>
          )}
        </section>
      </div>
    </div>
  );
}
