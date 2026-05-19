"use client";

import { Download, FolderDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetImage {
  id: string;
  url: string;
  promptUsed?: string;
}

interface AssetGridProps {
  images: AssetImage[];
  onSave?: (id: string) => void;
  onBatchDownload?: () => void;
  className?: string;
}

export function AssetGrid({ images, onSave, onBatchDownload, className }: AssetGridProps) {
  if (images.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">
          留存资产 · {images.length} 张
        </span>
        <button
          type="button"
          onClick={onBatchDownload}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <FolderDown size={13} />
          批量打包下载
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 border border-zinc-100"
          >
            <img
              src={img.url}
              alt={img.promptUsed ?? ""}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-1.5 opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-1">
                {onSave && (
                  <button
                    type="button"
                    onClick={() => onSave(img.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-white transition-colors shadow-sm"
                  >
                    留存入库
                  </button>
                )}
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-white transition-colors shadow-sm"
                >
                  <Download size={10} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
