"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertTriangle, X, Download, Send } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

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
  generationError,
  onDismissError,
  projectId,
}: StudioPreviewCanvasProps) {
  const { t } = useT();

  const quotaText = quotaLimit === -1
    ? t("generate.unlimited")
    : `${quotaLimit - quotaUsed}/${quotaLimit}`;

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
        <div className="flex gap-2">
          {latestImage && (
            <button type="button"
              onClick={async () => {
                const toast = (await import("sonner")).toast;
                toast.promise(
                  fetch("/api/upscale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: latestImage.url }) })
                    .then(r => r.json())
                    .then(d => { if (d.url && onHistorySelect) { onHistorySelect({ ...latestImage, url: d.url }); } }),
                  { loading: "超清增强中...", success: "增强完成", error: "增强失败" }
                );
              }}
              className="text-xs text-zinc-400 hover:text-brand-600 cursor-pointer transition-colors">
              {t("generate.engineFlux").includes("Pro") ? "超清增强" : "Upscale 4x"}
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
