"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("图片大小不能超过 10MB");
      return;
    }
    setError("");
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("请上传商品图片");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      if (hint.trim()) {
        formData.append("hint", hint.trim());
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "创建失败");
      }

      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="mb-8">
        <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>新建项目</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
          上传商品图片，AI 将自动分析商品并生成短视频脚本和素材
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-lg border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        {error && (
          <div
            className="error-state mb-4"
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "var(--error)",
              color: "#fff",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <label className="block mb-2" style={{ fontSize: 14, fontWeight: 500 }}>
          商品图片
        </label>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="mb-4 rounded-lg border-2 border-dashed cursor-pointer flex flex-col items-center justify-center transition-colors"
          style={{
            minHeight: 200,
            borderColor: dragOver ? "var(--accent)" : "var(--border)",
            background: dragOver ? "rgba(37, 99, 235, 0.04)" : "var(--bg)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="商品预览"
              className="max-w-full max-h-[300px] object-contain rounded-md"
            />
          ) : (
            <div className="text-center p-6">
              <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                点击上传或拖拽图片到此处
              </p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                支持 JPG、PNG、WebP，最大 10MB
              </p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <label
          htmlFor="hint"
          className="block mb-2"
          style={{ fontSize: 14, fontWeight: 500 }}
        >
          商品名称（可选）
        </label>
        <input
          id="hint"
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className="w-full px-3 py-2.5 rounded-md border mb-4"
          style={{
            background: "var(--bg)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-md)",
          }}
          placeholder="如：电动牙刷、蓝牙耳机..."
        />

        <div
          className="p-3 rounded-md mb-4"
          style={{
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            生成流程
          </p>
          <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <span>🖼️ 分析商品图</span>
            <span>→</span>
            <span>📝 AI 脚本</span>
            <span>→</span>
            <span>🖼️ 生成图片</span>
            <span>→</span>
            <span>🎬 生成视频</span>
            <span>→</span>
            <span>🔊 配音</span>
            <span>→</span>
            <span>✅ 审核发布</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            预计耗时 2-3 分钟
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full py-2.5 rounded-md font-medium transition-colors disabled:opacity-50"
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: "var(--radius-md)",
          }}
        >
          {loading ? "创建中..." : "开始生成"}
        </button>
      </form>
    </div>
  );
}
