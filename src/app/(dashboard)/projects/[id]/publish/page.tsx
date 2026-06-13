"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
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
  Download,
  Ruler,
  FileImage,
  Send,
} from "lucide-react";
import { PLATFORM_SPECS, PLATFORM_LIST } from "@/lib/platform-specs";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useT } from "@/components/i18n-provider";
import { usePlatformSpec } from "@/lib/use-platform-specs";

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

export default function PublishPage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(["SHOPIFY"])
  );
  const [results, setResults] = useState<
    { platform: string; status: string; postUrl?: string; error?: string }[]
  >([]);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProject(data.project);
      setLoading(false);
    } catch {
      setError(t("publish.loadProjectFailed"));
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
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const localizedSpecs = useMemo(
    () => PLATFORM_LIST.map((spec) => ({
      spec,
      localized: {
        name: t("platforms." + spec.platform + ".name"),
        background: t("platforms." + spec.platform + ".background"),
      },
    })),
    [t]
  );

  function getLocalizedName(spec: typeof PLATFORM_LIST[number]): string {
    const key = "platforms." + spec.platform + ".name";
    const entry = localizedSpecs.find((s) => s.spec.platform === spec.platform);
    const name = entry?.localized.name;
    return name && name !== key ? name : spec.name;
  }

  function getLocalizedBackground(spec: typeof PLATFORM_LIST[number]): string {
    const key = "platforms." + spec.platform + ".background";
    const entry = localizedSpecs.find((s) => s.spec.platform === spec.platform);
    const bg = entry?.localized.background;
    return bg && bg !== key ? bg : spec.background;
  }

  const publishableSelected = PLATFORM_LIST.filter(
    (p) => p.publishable && selectedPlatforms.has(p.platform)
  );
  const downloadOnlySelected = PLATFORM_LIST.filter(
    (p) => !p.publishable && selectedPlatforms.has(p.platform)
  );

  async function handleDownload() {
    if (selectedImages.size === 0) return;
    setDownloading(true);

    const succeededImages = project!.generatedImages.filter(
      (img) => img.status === "SUCCEEDED" && selectedImages.has(img.id)
    );

    // Build platform aware filename prefix
    const platformNames = PLATFORM_LIST.filter((p) =>
      selectedPlatforms.has(p.platform)
    )
      .map((p) => p.name)
      .join("_");
    const prefix = platformNames || "product";

    for (let i = 0; i < succeededImages.length; i++) {
      const img = succeededImages[i];
      try {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${prefix}_${i + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // skip failed downloads
      }
    }

    setDownloading(false);
  }

  async function handlePublish() {
    if (selectedImages.size === 0 || publishableSelected.length === 0) return;
    setPublishing(true);
    setError("");

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: project!.id,
          generatedImageIds: Array.from(selectedImages),
          platforms: publishableSelected.map((p) => p.platform),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("publish.failed"));
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.publishFailed"));
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
        <p className="text-destructive">{t("detail.projectNotFound")}</p>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="mt-4">
            <ArrowLeft size={14} className="mr-1" />
            {t("publish.backToDashboard")}
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
        <Breadcrumb items={[
          { label: t("products.title"), href: "/products" },
          { label: project.title || t("assets.unnamed"), href: `/projects/${project.id}` },
          { label: t("publish.publishAndDownload") },
        ]} />
        <h1 className="text-xl font-semibold">{t("publish.publishAndDownload")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("publish.desc")}
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
                {t("publish.selectImagesCount").replace("{selected}", String(selectedImages.size)).replace("{total}", String(succeededImages.length))}
              </h2>
              {succeededImages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("publish.noImages")}
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
                          borderColor: isSelected ? "#2563EB" : "transparent",
                          background: "var(--muted)",
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
                              style={{ background: "#2563EB" }}
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
              <h2 className="text-sm font-semibold mb-3">{t("publish.selectPlatform")}</h2>
              <div className="flex flex-col gap-3">
                {PLATFORM_LIST.map((spec) => {
                  const isSelected = selectedPlatforms.has(spec.platform);
                  return (
                    <div key={spec.platform}>
                      <button
                        type="button"
                        onClick={() => togglePlatform(spec.platform)}
                        className="flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer w-full"
                        style={{
                          borderColor: isSelected ? "#2563EB" : "var(--border)",
                          background: isSelected
                            ? "var(--accent)"
                            : "var(--card)",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Store size={18} className="text-muted-foreground" />
                          <div className="text-left">
                            <span className="text-sm font-medium">
                              {getLocalizedName(spec)}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={16} style={{ color: "#2563EB" }} />
                        )}
                      </button>
                      {isSelected && (
                        <div className="mt-2 ml-10 flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
                          <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-700 rounded px-2 py-0.5">
                            <Ruler size={9} />
                            {spec.dimensions}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-700 rounded px-2 py-0.5">
                            <FileImage size={9} />
                            {spec.formats.join(" / ")}
                          </span>
                          <span className="text-zinc-400 dark:text-zinc-500">
                            {t("platforms.maxImagesLabel").replace("{max}", String(spec.maxImages)).replace("{background}", getLocalizedBackground(spec))}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {/* Download — always available */}
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={handleDownload}
              disabled={downloading || selectedImages.size === 0}
            >
              <Download size={16} />
              {downloading
                ? t("publish.downloading")
                : t("publish.downloadImages").replace("{count}", String(selectedImages.size))}
            </Button>

            {/* Publish — only for publishable platforms */}
            {publishableSelected.length > 0 && (
              <Button
                variant="default"
                size="lg"
                className="w-full gap-2"
                onClick={handlePublish}
                disabled={
                  publishing || selectedImages.size === 0
                }
              >
                <Send size={16} />
                {publishing
                  ? t("publish.publishing")
                  : t("publish.publishToPlatforms").replace("{platforms}", publishableSelected.map((p) => p.name).join(" + "))}
              </Button>
            )}
          </div>
        </>
      ) : (
        /* Results */
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-4">{t("publish.results")}</h2>
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
                        {t("publish.publishSucceeded")}
                      </span>
                    ) : (
                      <span className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle size={14} />
                        {r.error || t("publish.failed")}
                      </span>
                    )}
                  </div>
                  {r.postUrl && (
                    <a
                      href={r.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                      style={{ color: "#2563EB" }}
                    >
                      {t("publish.viewProduct")} <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <Link href={`/projects/${project.id}`}>
                <Button variant="outline" size="sm">
                  {t("publish.backToProject")}
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="default" size="sm">
                  {t("publish.backToDashboard")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden anchor for download fallback */}
      <a ref={downloadRef} className="hidden" />
    </div>
  );
}
