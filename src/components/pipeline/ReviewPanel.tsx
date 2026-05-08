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
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>审核预览</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            审核所有生成的素材，确认后进入发布流程
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--bg)",
              color: "var(--error)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--error)",
            }}
          >
            ❌ 驳回
          </button>
          <button
            onClick={onApprove}
            disabled={loading}
            className="px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius-md)",
            }}
          >
            {loading ? "处理中..." : "✅ 批准并发布"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>📝 脚本</h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>
            {script.voiceover}
          </p>
          <div className="flex gap-2 mt-2">
            {script.hashtags?.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--bg)", color: "var(--accent)" }}>
                #{tag}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>🖼️ 图片 ({images.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="flex-shrink-0 rounded-lg overflow-hidden border"
                style={{ width: 120, borderColor: "var(--border)", borderRadius: "var(--radius-md)" }}
              >
                <div className="aspect-[9/16]" style={{ background: "#1A1A1F" }}>
                  {img.url && (
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-1.5 text-center" style={{ fontSize: 11 }}>
                  场景 {img.stageIndex + 1}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>🎬 视频片段 ({videos.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {videos.map((vid) => (
              <div
                key={vid.id}
                className="flex-shrink-0 rounded-lg overflow-hidden border"
                style={{ width: 120, borderColor: "var(--border)", borderRadius: "var(--radius-md)" }}
              >
                <div className="aspect-[9/16]" style={{ background: "#1A1A1F" }}>
                  {vid.url && (
                    <video src={vid.url} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-1.5 text-center" style={{ fontSize: 11 }}>
                  片段 {vid.stageIndex + 1}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>🔊 配音</h3>
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
