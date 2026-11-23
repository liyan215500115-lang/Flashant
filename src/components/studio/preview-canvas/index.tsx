"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertTriangle, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { downloadUrl } from "@/lib/download-image";
import { viewedShotFileUrl } from "@/lib/viewed-shot";
import { quotaBadgeText } from "@/lib/quota-display";
import { toast } from "sonner";

interface PreviewImage {
  id: string;
  url: string;
  promptUsed?: string;
}

interface StudioPreviewCanvasProps {
  isGenerating: boolean;
  latestImage: PreviewImage | null;
  generationHistory?: PreviewImage[];
  onHistorySelect?: (image: PreviewImage) => void;
  quotaUsed: number;
  quotaLimit: number;
  quotaTier?: string | null;
  allotmentConfigured?: boolean;
  quotaLoading?: boolean;
  generationError?: string;
  onDismissError?: () => void;
  projectId?: string | null;
}

export function StudioPreviewCanvas({
  isGenerating,
  latestImage,
  generationHistory = [],
  onHistorySelect,
  quotaUsed,
  quotaLimit,
  quotaTier,
  allotmentConfigured,
  quotaLoading = false,
  generationError,
  onDismissError,
  projectId,
}: StudioPreviewCanvasProps) {
  const { t } = useT();

  const quotaText = quotaBadgeText({
    used: quotaUsed,
    limit: quotaLimit,
    tier: quotaTier,
    allotmentConfigured,
    loading: quotaLoading,
  }, t("generate.unlimited"));

  return (
    <div className="flex flex-col gap-4">
      {/* Error banner */}
      {generationError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">{t("error.generateFailed")}</p>
            <p className="text-sm text-red-600 mt-0.5">{generationError}</p>
          </div>
          {onDismissError && (
            <button onClick={onDismissError} className="text-red-400 hover:text-red-600 shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Main preview area */}
      <div className="relative aspect-square rounded-xl bg-zinc-50 border border-zinc-100 overflow-hidden">
        {isGenerating ? (
          <div className="absolute inset-0">
            <Skeleton className="w-full h-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white rounded-xl px-6 py-4 text-center shadow-sm border border-zinc-200">
                <div className="flex gap-1.5 justify-center mb-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <p className="text-sm font-medium text-zinc-700">{t("generate.generatingOverlay")}</p>
              </div>
            </div>
          </div>
        ) : latestImage ? (
          <div className="relative w-full h-full">
            <img src={latestImage.url} alt={latestImage.promptUsed ?? t("generate.generatedAlt")} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-brand-50 flex items-center justify-center">
                <Sparkles size={28} className="text-brand-300" />
              </div>
              <p className="text-sm font-medium text-zinc-400">{t("generate.emptyPreview")}</p>
              <p className="text-xs text-zinc-300 mt-1">{t("generate.uploadHint")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Generation history thumbnails */}
      {generationHistory.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
          {generationHistory.map((img) => (
            <button key={img.id} type="button" onClick={() => onHistorySelect?.(img)}
              className={cn(
                "shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                latestImage?.id === img.id
                  ? "border-brand-600 ring-1 ring-brand-600/20"
                  : "border-zinc-200 hover:border-zinc-300 opacity-60 hover:opacity-100"
              )}>
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Actions + Quota */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {latestImage && (
            <button
              type="button"
              onClick={() => {
                const target = viewedShotFileUrl(latestImage);
                if (!target) {
                  toast.error(t("generate.downloadFailed"));
                  return;
                }
                const fileName = latestImage.id
                  ? `flashant-${latestImage.id.slice(0, 8)}.png`
                  : "flashant.png";
                void downloadUrl(target, fileName).then((ok) => {
                  if (!ok) toast.error(t("generate.downloadFailed"));
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 cursor-pointer transition-colors"
            >
              <Download size={14} />
              {t("generate.downloadImage")}
            </button>
          )}
          {latestImage && (
            <button type="button"
              onClick={async () => {
                const toast = (await import("sonner")).toast;
                toast.promise(
                  fetch("/api/upscale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: latestImage.url }) })
                    .then(async (r) => {
                      const d = await r.json();
                      if (!r.ok || !d.url) throw new Error(d.message || d.error || t("generate.upscaleError"));
                      if (onHistorySelect) onHistorySelect({ ...latestImage, url: d.url });
                    }),
                  { loading: t("generate.upscaleLoading"), success: t("generate.upscaleSuccess"), error: (err) => err instanceof Error ? err.message : t("generate.upscaleError") }
                );
              }}
              className="text-xs text-zinc-400 hover:text-brand-600 cursor-pointer transition-colors">
              {t("generate.upscaleButton")}
            </button>
          )}
        </div>
        <span className="text-xs text-zinc-400">
          {t("generate.quotaLabel")}：{quotaText}
        </span>
      </div>
    </div>
  );
}
