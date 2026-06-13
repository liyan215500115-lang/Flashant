"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertTriangle, X, Download, Send, FileText } from "lucide-react";
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
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              <a href={latestImage.url} download target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-medium text-zinc-700 hover:bg-white shadow-sm transition-colors">
                <Download size={13} /> {t("generate.downloadImage")}
              </a>
              {projectId && (
                <Link href={`/projects/${projectId}/publish`}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-900/90 backdrop-blur-sm text-xs font-medium text-white hover:bg-brand-800 shadow-sm transition-colors">
                  <Send size={13} /> {t("publish.publishBtn")}
                </Link>
              )}
            </div>
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
      {generationHistory.length > 1 && (
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

      {/* Detail images link — shown after generation */}
      {latestImage && projectId && (
        <Link href={`/projects/${projectId}/details`}
          className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:shadow-sm transition-shadow">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <FileText size={16} className="text-brand-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-700">{t("studio.detailImages")}</p>
            <p className="text-xs text-zinc-400">{t("studio.detailImagesDesc")}</p>
          </div>
        </Link>
      )}

      {/* Quota badge */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-zinc-400">
          {t("generate.quotaLabel")}：{quotaText}
        </span>
      </div>
    </div>
  );
}
