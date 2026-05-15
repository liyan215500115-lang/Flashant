import { Button } from "@/components/ui/button";

interface VideoAsset {
  id: string;
  url: string;
  stageIndex: number;
  aiProvider: string | null;
}

interface VideoPreviewProps {
  videos: VideoAsset[];
  onContinue: () => void;
  onRegenerate: () => void;
  loading: boolean;
}

const SCENE_LABELS = ["开场", "细节", "场景"];

export function VideoPreview({ videos, onContinue, onRegenerate, loading }: VideoPreviewProps) {
  const isMock = videos[0]?.aiProvider?.startsWith("mock");
  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url) || url.startsWith("/uploads/");

  return (
    <div className="flex flex-col gap-6">
      <div className="section-header">
        <div>
          <h2 className="section-title">生成的视频片段</h2>
          <p className="section-subtitle">
            AI 已将 {videos.length} 张图片转为视频片段
            {isMock && (
              <span
                className="inline-flex ml-2 px-2 py-0.5 rounded-full"
                style={{ fontSize: 11, background: "var(--warning)", color: "#fff" }}
              >
                MOCK · 配置 API Key 后可生成动态视频
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRegenerate} disabled={loading}>
            🔄 重新生成
          </Button>
          <Button variant="default" onClick={onContinue} disabled={loading}>
            {loading ? "合成中..." : "✅ 确认并合成配音"}
          </Button>
        </div>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {videos.map((vid) => (
          <div
            key={vid.id}
            className="card-static overflow-hidden"
          >
            <div className="media-canvas">
              {vid.url && isImageUrl(vid.url) ? (
                <img
                  src={vid.url}
                  alt={`视频片段 ${vid.stageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : vid.url ? (
                <video
                  src={vid.url}
                  controls
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
              ) : (
                <div className="skeleton rounded-md" style={{ width: "100%", height: "100%" }} />
              )}
              {isMock && vid.url && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.3)" }}
                >
                  <div
                    className="rounded-full flex items-center justify-center"
                    style={{ width: 56, height: 56, background: "rgba(255,255,255,0.2)" }}
                  >
                    <span style={{ fontSize: 24 }}>▶️</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                片段 {vid.stageIndex + 1} · {SCENE_LABELS[vid.stageIndex] ?? "详情"}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {vid.aiProvider || "AI"} · 5s
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
