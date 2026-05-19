"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Check,
  ShoppingBag,
  AlertCircle,
  ExternalLink,
  Store,
} from "lucide-react";

interface GeneratedImage {
  id: string;
  url: string;
  status: string;
  productImageId: string | null;
}

interface Project {
  id: string;
  title: string;
  status: string;
  generatedImages: GeneratedImage[];
}

const PLATFORMS = [
  { key: "SHOPIFY", name: "Shopify", available: true },
  { key: "TIKTOK_SHOP", name: "TikTok Shop", available: false },
  { key: "ETSY", name: "Etsy", available: false },
];

export default function PublishPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(["SHOPIFY"])
  );
  const [results, setResults] = useState<
    { platform: string; status: string; postUrl?: string; error?: string }[]
  >([]);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProject(data.project);
      // Auto-select all succeeded images
      const succeeded = data.project.generatedImages
        .filter((img: GeneratedImage) => img.status === "SUCCEEDED")
        .map((img: GeneratedImage) => img.id);
      setSelectedImages(new Set(succeeded));
      setLoading(false);
    } catch {
      setError("加载项目失败");
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  function toggleImage(id: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePlatform(key: string) {
    if (!PLATFORMS.find((p) => p.key === key)?.available) return;
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handlePublish() {
    if (selectedImages.size === 0 || selectedPlatforms.size === 0) return;
    setPublishing(true);
    setError("");

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: project!.id,
          generatedImageIds: Array.from(selectedImages),
          platforms: Array.from(selectedPlatforms),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "发布失败");
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败，请重试");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-[720px] mx-auto py-8">
        <p className="text-destructive">项目未找到</p>
        <Link href="/">
          <Button variant="outline" size="sm" className="mt-4">
            <ArrowLeft size={14} className="mr-1" />
            返回工作台
          </Button>
        </Link>
      </div>
    );
  }

  const succeededImages = project.generatedImages.filter(
    (img) => img.status === "SUCCEEDED"
  );
  const isDone = results.length > 0;

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href={`/products/${project.id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft size={14} />
          返回项目
        </Link>
        <h1 className="text-xl font-semibold">发布商品图</h1>
        <p className="text-sm text-muted-foreground mt-1">
          选择图片和平台，一键发布到电商店铺
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!isDone ? (
        <>
          {/* Select Images */}
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold mb-3">
                选择图片 ({selectedImages.size}/{succeededImages.length})
              </h2>
              {succeededImages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  暂无已生成的图片。请先生成商品图。
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {succeededImages.map((img) => {
                    const isSelected = selectedImages.has(img.id);
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => toggleImage(img.id)}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all"
                        style={{
                          borderColor: isSelected ? "var(--accent)" : "transparent",
                          background: "var(--bg)",
                        }}
                      >
                        <img
                          src={img.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: "var(--accent)" }}
                            >
                              <Check size={12} color="#fff" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Select Platforms */}
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold mb-3">选择平台</h2>
              <div className="flex flex-col gap-2">
                {PLATFORMS.map((platform) => {
                  const isSelected = selectedPlatforms.has(platform.key);
                  return (
                    <button
                      key={platform.key}
                      type="button"
                      onClick={() => togglePlatform(platform.key)}
                      disabled={!platform.available}
                      className="flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: isSelected ? "var(--accent)" : "var(--border)",
                        background: isSelected ? "var(--accent-subtle)" : "var(--surface)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Store size={18} className="text-muted-foreground" />
                        <div className="text-left">
                          <span className="text-sm font-medium">{platform.name}</span>
                          {!platform.available && (
                            <span className="text-xs text-muted-foreground ml-2">
                              即将上线
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check size={16} style={{ color: "var(--accent)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            variant="default"
            size="lg"
            className="w-full gap-2"
            onClick={handlePublish}
            disabled={publishing || selectedImages.size === 0 || selectedPlatforms.size === 0}
          >
            <ShoppingBag size={16} />
            {publishing ? "发布中..." : `发布 ${selectedImages.size} 张图片`}
          </Button>
        </>
      ) : (
        /* Results */
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-4">发布结果</h2>
            <div className="flex flex-col gap-3">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{r.platform}</Badge>
                    {r.status === "published" ? (
                      <span className="text-sm text-emerald-600 flex items-center gap-1">
                        <Check size={14} />
                        发布成功
                      </span>
                    ) : (
                      <span className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle size={14} />
                        {r.error || "发布失败"}
                      </span>
                    )}
                  </div>
                  {r.postUrl && (
                    <a
                      href={r.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                      style={{ color: "var(--accent)" }}
                    >
                      查看商品 <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <Link href={`/products/${project.id}`}>
                <Button variant="outline" size="sm">
                  返回项目
                </Button>
              </Link>
              <Link href="/">
                <Button variant="default" size="sm">
                  返回工作台
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
