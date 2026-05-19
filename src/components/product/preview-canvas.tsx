"use client";

import { Download, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  className?: string;
}

export function PreviewCanvas({
  isGenerating,
  generatedImages,
  latestImage,
  quotaUsed,
  quotaLimit,
  className,
}: PreviewCanvasProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">画布预演</h2>
        <span className="text-xs text-zinc-500 bg-zinc-100 rounded-full px-3 py-1">
          本月剩余额度：{quotaLimit === -1 ? "无限" : `${quotaUsed}/${quotaLimit}`}
        </span>
      </div>

      {/* Main preview area */}
      <div className="relative aspect-square rounded-xl bg-zinc-50 overflow-hidden border border-zinc-100">
        {isGenerating ? (
          /* Loading state */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Skeleton className="absolute inset-0 rounded-none" />
            <div className="relative z-10 flex flex-col items-center gap-3 px-6 py-8 rounded-2xl bg-white/80 backdrop-blur-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <p className="text-sm text-zinc-600 text-center">
                闪象正在为你重构画面
                <br />
                <span className="text-xs text-zinc-400">
                  预计需要 5-8 秒...
                </span>
              </p>
            </div>
          </div>
        ) : latestImage ? (
          /* Success state */
          <img
            src={latestImage.url}
            alt="生成结果"
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          /* Empty state */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center">
              <span className="text-2xl font-light text-zinc-300">+</span>
            </div>
            <p className="text-sm">上传图片并点击生成</p>
          </div>
        )}
      </div>

      {/* History grid */}
      {generatedImages.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-zinc-600">
            历史生成 ({generatedImages.length})
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {generatedImages.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 transition-all hover:scale-[1.02] hover:shadow-md"
              >
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={img.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 hover:bg-white shadow-sm transition-colors"
                    title="下载"
                  >
                    <Download size={13} className="text-zinc-700" />
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      alert("同步至 Shopify 功能即将上线")
                    }
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 hover:bg-white shadow-sm transition-colors"
                    title="同步至 Shopify"
                  >
                    <ShoppingBag size={13} className="text-zinc-700" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
