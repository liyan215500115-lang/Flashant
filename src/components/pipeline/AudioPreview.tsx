import type { ScriptGenerationResult } from "@/lib/ai/types";

interface AudioAsset {
  id: string;
  url: string;
  aiProvider: string | null;
  generationMeta: Record<string, unknown> | null;
}

interface AudioPreviewProps {
  audio: AudioAsset | undefined;
  script: ScriptGenerationResult;
  onContinue: () => void;
  onRegenerate: () => void;
  loading: boolean;
}

export function AudioPreview({ audio, script, onContinue, onRegenerate, loading }: AudioPreviewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>配音预览</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            AI 配音已生成，请试听确认
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
            {loading ? "处理中..." : "✅ 进入审核"}
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
        {audio?.url ? (
          <audio src={audio.url} controls className="w-full mb-4" />
        ) : (
          <div className="skeleton rounded-md mb-4" style={{ height: 48, width: "100%" }} />
        )}

        <div
          className="p-3 rounded-md"
          style={{ background: "var(--bg)", borderRadius: "var(--radius-md)" }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>配音文本</p>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{script.voiceover}</p>
        </div>

        {audio?.aiProvider && (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
            引擎: {audio.aiProvider} | 时长: {Math.round((audio.generationMeta?.durationSeconds as number) || script.scenes.reduce((s, sc) => s + sc.durationSeconds, 0))}s
          </p>
        )}
      </div>
    </div>
  );
}
