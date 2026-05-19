"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Sparkles, ShoppingBag, Check } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface PromptTemplate {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  category: string;
  previewUrl: string | null;
}

export default function NewProductPage() {
  const { t, locale } = useT();
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
  const [uploading, setUploading] = useState(false);
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
      setError(t("error.unsupportedFile"));
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError(t("error.fileTooLarge"));
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
      setError(t("error.uploadFailed"));
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Get upload config (S3 pre-signed URL or local mode)
      setUploading(true);
      const urlRes = await fetch(
        `/api/upload-url?fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`
      );
      if (!urlRes.ok) {
        const data = await urlRes.json();
        throw new Error(data.message || t("error.uploadFailed"));
      }
      const config = await urlRes.json();

      let s3Key: string;
      let publicUrl: string;

      if (config.mode === "local") {
        // Step 2a: Local storage — POST file directly
        const formData = new FormData();
        formData.append("file", file);
        const localRes = await fetch("/api/upload-url", {
          method: "POST",
          body: formData,
        });
        if (!localRes.ok) throw new Error(t("error.uploadFailed"));
        const localData = await localRes.json();
        s3Key = localData.s3Key;
        publicUrl = localData.publicUrl;
      } else {
        // Step 2b: S3 — PUT to pre-signed URL
        const uploadRes = await fetch(config.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(t("error.uploadFailed"));
        s3Key = config.s3Key;
        publicUrl = config.publicUrl;
      }
      setUploading(false);

      // Step 3: Create project in DB
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || file.name,
          promptTemplateId: selectedTemplateId,
          s3Key,
          originalUrl: publicUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("error.createFailed"));
      }

      const project = await res.json();
      router.push(`/products/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.createFailed"));
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("products.newTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("products.newDesc")}
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
              <h2 className="text-sm font-semibold">{t("products.uploadStep")}</h2>
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
                    alt="Preview"
                    className="max-w-full max-h-[260px] object-contain rounded-md mx-auto"
                  />
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">{t("products.uploaded")}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      · {t("products.clickToChange")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6">
                  <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">{t("products.dragOrClick")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("products.uploadHint")}
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
                {t("products.productName")}
              </label>
              <Input
                id="product-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("products.productNamePlaceholder")}
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
              <h2 className="text-sm font-semibold">{t("products.templateStep")}</h2>
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
                        {locale === "zh" ? tpl.nameZh || tpl.name : tpl.name}
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
          {uploading ? t("products.uploading") : submitting ? t("products.creating") : t("products.startGenerate")}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          {t("products.estimatedTime")}
        </p>
      </form>
    </div>
  );
}
