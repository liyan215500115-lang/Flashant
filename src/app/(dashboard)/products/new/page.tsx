"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Sparkles, ShoppingBag, Check } from "lucide-react";

interface PromptTemplate {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  category: string;
  previewUrl: string | null;
}

export default function NewProductPage() {
  const router = useRouter();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load templates on mount
  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        setTemplatesLoading(false);
        if (data.templates?.length > 0) {
          setSelectedTemplateId(data.templates[0].id);
        }
      })
      .catch(() => setTemplatesLoading(false));
  }, []);

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
    // Auto-fill title from filename
    if (!title) {
      const name = f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("请上传商品图片");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("title", title || file.name);
      if (selectedTemplateId) {
        formData.append("promptTemplateId", selectedTemplateId);
      }

      const res = await fetch("/api/products", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "创建失败");
      }

      const project = await res.json();
      router.push(`/products/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">新建商品图</h1>
        <p className="text-sm text-muted-foreground mt-1">
          上传产品图片，选择场景模板，AI 自动生成多场景商品图
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                1
              </span>
              <h2 className="text-sm font-semibold">上传产品图片</h2>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
              className="rounded-lg border-2 border-dashed cursor-pointer flex flex-col items-center justify-center transition-all"
              style={{
                minHeight: 220,
                borderColor: dragOver ? "var(--accent)" : file ? "var(--border)" : "var(--border)",
                background: dragOver ? "var(--accent-subtle)" : "var(--bg)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              {preview ? (
                <div className="relative w-full h-full p-3">
                  <img
                    src={preview}
                    alt="预览"
                    className="max-w-full max-h-[260px] object-contain rounded-md mx-auto"
                  />
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">已上传</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      · 点击更换
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6">
                  <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">拖拽或点击上传产品图片</p>
                  <p className="text-xs text-muted-foreground">
                    支持 JPG、PNG、WebP，最大 10MB
                  </p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <div className="mt-4">
              <label
                htmlFor="product-title"
                className="block mb-1.5 text-xs font-medium text-muted-foreground"
              >
                商品名称（可选）
              </label>
              <Input
                id="product-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="如：无线蓝牙耳机、有机绿茶..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Select Template */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                2
              </span>
              <h2 className="text-sm font-semibold">选择场景模板</h2>
            </div>

            {templatesLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className="text-left p-3 rounded-lg border-2 transition-all cursor-pointer"
                    style={{
                      borderColor:
                        selectedTemplateId === tpl.id
                          ? "var(--accent)"
                          : "var(--border)",
                      background:
                        selectedTemplateId === tpl.id
                          ? "var(--accent-subtle)"
                          : "var(--surface)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles
                        size={14}
                        style={{
                          color:
                            selectedTemplateId === tpl.id
                              ? "var(--accent)"
                              : "var(--text-secondary)",
                        }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {tpl.nameZh || tpl.name}
                      </span>
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {tpl.description || tpl.category}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          variant="default"
          size="lg"
          disabled={submitting || !file}
          className="w-full justify-center gap-2"
        >
          <ShoppingBag size={16} />
          {submitting ? "创建中..." : "开始生成商品图"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          预计耗时 15-30 秒，AI 将为每张产品图生成 2 个场景图
        </p>
      </form>
    </div>
  );
}
