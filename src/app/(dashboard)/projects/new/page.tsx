"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("请输入商品链接");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productUrl: url.trim() }),
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
          粘贴电商商品链接，AI 将自动生成短视频脚本和素材
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
          <div className="error-state mb-4">{error}</div>
        )}

        <label
          htmlFor="productUrl"
          className="block mb-2"
          style={{ fontSize: 14, fontWeight: 500 }}
        >
          商品链接
        </label>
        <input
          id="productUrl"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-md border mb-4"
          style={{
            background: "var(--bg)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-md)",
          }}
          placeholder="https://item.taobao.com/... 或 https://detail.tmall.com/..."
        />

        <div
          className="p-3 rounded-md mb-4"
          style={{
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            💡 生成流程
          </p>
          <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <span>🔗 解析链接</span>
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
          disabled={loading}
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
