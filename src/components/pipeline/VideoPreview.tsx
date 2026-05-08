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

export function VideoPreview({ videos, onContinue, onRegenerate, loading }: VideoPreviewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>生成的视频片段</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            AI 已将 {videos.length} 张图片转为视频片段
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--bg)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            🔄 重新生成
          </button>
          <button
            onClick={onContinue}
            disabled={loading}
            className="px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius-md)",
            }}
          >
            {loading ? "合成中..." : "✅ 确认并合成配音"}
          </button>
        </div>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {videos.map((vid) => (
          <div
            key={vid.id}
            className="rounded-lg overflow-hidden border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div
              className="aspect-[9/16] flex items-center justify-center"
              style={{ background: "#1A1A1F" }}
            >
              {vid.url ? (
                <video
                  src={vid.url}
                  controls
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
              ) : (
                <div className="skeleton rounded-md" style={{ width: "100%", height: "100%" }} />
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                片段 {vid.stageIndex + 1}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {vid.aiProvider || "AI"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
