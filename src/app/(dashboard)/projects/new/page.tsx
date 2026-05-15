"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FLOW_STEPS = [
  { icon: "🖼️", label: "分析商品图" },
  { icon: "📝", label: "AI 脚本" },
  { icon: "🖼️", label: "生成图片" },
  { icon: "🎬", label: "生成视频" },
  { icon: "🔊", label: "配音" },
  { icon: "✅", label: "审核发布" },
];

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
      if (hint.trim()) formData.append("hint", hint.trim());

      const res = await fetch("/api/projects", { method: "POST", body: formData });

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
        <h1 className="section-title">新建项目</h1>
        <p className="section-subtitle">
          上传商品图片，AI 将自动分析商品并生成短视频脚本和素材
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card-static p-6">
        {error && (
          <div className="mb-4 rounded-md bg-destructive px-3 py-2 text-sm text-white">
            {error}
          </div>
        )}

        <label
          className="block mb-2"
          style={{ fontSize: 14, fontWeight: 500 }}
          htmlFor="image-upload"
        >
          商品图片
        </label>

        <div
          id="image-upload"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          className="mb-5 rounded-lg border-2 border-dashed cursor-pointer flex flex-col items-center justify-center transition-all"
          style={{
            minHeight: 200,
            borderColor: dragOver ? "var(--accent)" : "var(--border)",
            background: dragOver ? "var(--accent-subtle)" : "var(--bg)",
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
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.6 }}>📷</div>
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
        <Input
          id="hint"
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className="mb-5"
          placeholder="如：电动牙刷、蓝牙耳机..."
        />

        <div
          className="p-4 rounded-lg mb-5"
          style={{
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
            生成流程
          </p>
          <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 12 }}>
            {FLOW_STEPS.map((step, i) => (
              <span key={step.label} className="flex items-center gap-1">
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    fontSize: 11,
                  }}
                >
                  <span>{step.icon}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{step.label}</span>
                </span>
                {i < FLOW_STEPS.length - 1 && (
                  <span style={{ color: "var(--text-secondary)", margin: "0 1px" }}>→</span>
                )}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
            预计耗时 2-3 分钟
          </p>
        </div>

        <Button
          type="submit"
          variant="default"
          size="lg"
          disabled={loading || !file}
          className="w-full justify-center"
        >
          {loading ? "创建中..." : "开始生成"}
        </Button>
      </form>
    </div>
  );
}
