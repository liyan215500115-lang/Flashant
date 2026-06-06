"use client";

import { Download, ShoppingCart, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import Link from "next/link";

interface GeneratedImage {
  id: string;
  url: string;
  status: string;
  promptUsed: string | null;
  createdAt: string;
}

interface PreviewCanvasProps {
  isGenerating: boolean;
  generatedImages: GeneratedImage[];
  latestImage: GeneratedImage | null;
  quotaUsed: number;
  quotaLimit: number;
  projectId?: string;
  className?: string;
}

export function PreviewCanvas({
  isGenerating,
  generatedImages,
  latestImage,
  quotaUsed,
  quotaLimit,
  projectId,
  className,
}: PreviewCanvasProps) {
  const { t } = useT();

  const quotaText =
    quotaLimit === Infinity || quotaLimit <= 0
      ? t("generate.unlimited")
      : `${Math.max(0, quotaLimit - quotaUsed)}/${quotaLimit}`;

  // Usage bar: color shifts to warning at 80%+
  const usageRatio = quotaLimit > 0 ? Math.min(quotaUsed / quotaLimit, 1) : 0;
  const usageColor =
    usageRatio >= 0.9
      ? "bg-red-500"
      : usageRatio >= 0.8
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className={cn("flex flex-col gap-5 flex-1 min-w-0", className)}>
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t("generate.canvasTitle")}
        </h2>
        <div className="flex items-center gap-2">
          {/* Mini usage bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", usageColor)}
                style={{ width: `${usageRatio * 100}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1 tabular-nums">
            {t("generate.quotaLabel")}：{quotaText}
          </span>
        </div>
      </div>

      {/* Main preview area */}
      <div className="relative aspect-square rounded-xl bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden border border-zinc-100 dark:border-zinc-800">
        {isGenerating ? (
          /* ── Generating: breathing skeleton with overlay ── */
          <div className="absolute inset-0">
            {/* Shimmer skeleton */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-100 dark:from-zinc-800 dark:via-zinc-800/50 dark:to-zinc-800 animate-pulse" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)] animate-pulse" />

            {/* Floating overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative z-10 flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-xl shadow-zinc-200/20 dark:shadow-black/20">
                {/* Pulsing dots */}
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 text-center max-w-[260px] leading-relaxed">
                  {t("generate.generatingOverlay")}
                </p>
              </div>
            </div>
          </div>
        ) : latestImage ? (
          /* ── Success: display latest generated image ── */
          <div className="group relative w-full h-full">
            <img
              src={latestImage.url}
              alt={t("generate.generatedAlt")}
              className="w-full h-full object-cover rounded-xl"
            />
            {/* Subtle overlay on hover */}
            <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
          </div>
        ) : (
          /* ── Empty state ── */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/50">
              <Sparkles size={28} className="text-zinc-300 dark:text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                {t("generate.emptyPreview")}
              </p>
              <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-0.5">
                {t("generate.slogan")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* History grid */}
      {generatedImages.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t("generate.historyLabel").replace("{count}", String(generatedImages.length))}
            </h3>
            {projectId && (
              <Link
                href={`/products/${projectId}/publish`}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
              >
                <ShoppingCart size={12} />
                {t("detail.publishToPlatform")}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {generatedImages.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-black/30 hover:z-10"
              >
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover"
                />

                {/* Hover actions: download + sync to Shopify */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-2.5 gap-1.5">
                  {/* Download */}
                  <a
                    href={img.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/95 hover:bg-white text-[11px] font-medium text-zinc-700 shadow-sm transition-colors"
                    title={t("generate.downloadImage")}
                  >
                    <Download size={11} />
                    {t("generate.downloadImage")}
                  </a>

                  {/* Sync to Shopify */}
                  {projectId && (
                    <Link
                      href={`/products/${projectId}/publish`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/95 hover:bg-white text-[11px] font-medium text-zinc-700 shadow-sm transition-colors"
                      title={t("generate.syncToShopify")}
                    >
                      <ShoppingCart size={11} />
                      {t("generate.syncToShopify")}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
