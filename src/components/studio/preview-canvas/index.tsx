"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { SecondaryTabs } from "./secondary-tabs";
import { AssetGrid } from "./asset-grid";

interface PreviewImage {
  id: string;
  url: string;
  promptUsed?: string;
}

interface StudioPreviewCanvasProps {
  isGenerating: boolean;
  latestImage: PreviewImage | null;
  assetImages: PreviewImage[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAssetSave?: (id: string) => void;
  onBatchDownload?: () => void;
  quotaUsed: number;
  quotaLimit: number;
}

export function StudioPreviewCanvas({
  isGenerating,
  latestImage,
  assetImages,
  activeTab,
  onTabChange,
  onAssetSave,
  onBatchDownload,
  quotaUsed,
  quotaLimit,
}: StudioPreviewCanvasProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Secondary tabs */}
      <SecondaryTabs value={activeTab} onChange={onTabChange} />

      {/* Main preview area */}
      <div className="relative aspect-square rounded-xl bg-zinc-50 border border-zinc-100 overflow-hidden">
        {isGenerating ? (
          <div className="absolute inset-0">
            <Skeleton className="w-full h-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl px-6 py-4 text-center shadow-sm">
                <div className="flex gap-1.5 justify-center mb-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium text-zinc-700">闪象正在为你重构画面</p>
                <p className="text-xs text-zinc-400 mt-0.5">预计需要 5-8 秒...</p>
              </div>
            </div>
          </div>
        ) : latestImage ? (
          <img
            src={latestImage.url}
            alt={latestImage.promptUsed ?? "生成图"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Sparkles size={32} className="mx-auto mb-3 text-zinc-300" />
              <p className="text-sm text-zinc-400">上传图片并点击生成</p>
            </div>
          </div>
        )}
      </div>

      {/* Quota badge */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-zinc-400">
          本月剩余额度：{quotaLimit === -1 ? "无限" : `${quotaLimit - quotaUsed}/${quotaLimit}`}
        </span>
      </div>

      {/* Asset grid */}
      <AssetGrid images={assetImages} onSave={onAssetSave} onBatchDownload={onBatchDownload} />
    </div>
  );
}
