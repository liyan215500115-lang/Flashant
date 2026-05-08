import type { ScriptGenerationResult } from "@/lib/ai/types";

interface ScriptEditorProps {
  script: ScriptGenerationResult;
  onApprove: () => void;
  onRegenerate: () => void;
  loading: boolean;
}

export function ScriptEditor({ script, onApprove, onRegenerate, loading }: ScriptEditorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>AI 脚本与分镜</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>审核并编辑 AI 生成的脚本和分镜方案</p>
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
            onClick={onApprove}
            disabled={loading}
            className="px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius-md)",
            }}
          >
            {loading ? "处理中..." : "✅ 确认并生成图片"}
          </button>
        </div>
      </div>

      <div
        className="p-4 rounded-lg border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>完整配音稿</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>
          {script.voiceover}
        </p>
        {script.hashtags?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {script.hashtags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: "var(--bg)", color: "var(--accent)" }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>分镜列表</h3>
        {script.scenes.map((scene) => (
          <div
            key={scene.index}
            className="p-4 rounded-lg border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span
                className="inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {scene.index}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{scene.description}</span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: "auto" }}>
                ⏱ {scene.durationSeconds}s
              </span>
            </div>

            <div className="flex flex-col gap-2" style={{ fontSize: 13 }}>
              <div className="flex gap-2">
                <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>画面:</span>
                <span>{scene.imagePrompt}</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>动效:</span>
                <span>{scene.videoPrompt}</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>配音:</span>
                <span>{scene.voiceoverText}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
