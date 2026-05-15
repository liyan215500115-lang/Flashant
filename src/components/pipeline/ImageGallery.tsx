import { Button } from "@/components/ui/button";

interface SceneInfo {
  index: number;
  description: string;
  imagePrompt: string;
}

interface ImageAsset {
  id: string;
  url: string;
  stageIndex: number;
  aiProvider: string | null;
}

interface ImageGalleryProps {
  images: ImageAsset[];
  scenes?: SceneInfo[];
  onContinue: () => void;
  onRegenerate: () => void;
  loading: boolean;
}

const SCENE_LABELS = ["开场", "细节", "场景"];

export function ImageGallery({ images, scenes, onContinue, onRegenerate, loading }: ImageGalleryProps) {
  const isMock = images[0]?.aiProvider?.startsWith("mock");

  return (
    <div className="flex flex-col gap-6">
      <div className="section-header">
        <div>
          <h2 className="section-title">生成的图片</h2>
          <p className="section-subtitle">
            AI 已生成 {images.length} 张场景图片
            {isMock && (
              <span
                className="inline-flex ml-2 px-2 py-0.5 rounded-full"
                style={{ fontSize: 11, background: "var(--warning)", color: "#fff" }}
              >
                MOCK · 配置 API Key 后可生成真实场景图
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRegenerate} disabled={loading}>
            🔄 重新生成
          </Button>
          <Button variant="default" onClick={onContinue} disabled={loading}>
            {loading ? "生成中..." : "✅ 确认并生成视频"}
          </Button>
        </div>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {images.map((img) => {
          const scene = scenes?.find((s) => s.index === img.stageIndex);
          return (
            <div
              key={img.id}
              className="card-static overflow-hidden"
            >
              <div className="media-canvas">
                {img.url ? (
                  <img src={img.url} alt={`场景 ${img.stageIndex}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="skeleton" style={{ width: "100%", height: "100%", borderRadius: 0 }} />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    场景 {img.stageIndex + 1} · {SCENE_LABELS[img.stageIndex] ?? "详情"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {img.aiProvider || "AI"}
                  </span>
                </div>
                {scene && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {scene.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
