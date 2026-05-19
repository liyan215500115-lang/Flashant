"use client";

import { useState, useRef } from "react";
import { Upload, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

interface ImageUploadZoneProps {
  projectId: string;
  currentImage: ProductImage | null;
  onImageChange: (image: ProductImage) => void;
  className?: string;
}

export function ImageUploadZone({
  projectId,
  currentImage,
  onImageChange,
  className,
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);

    try {
      // Get upload config (S3 pre-signed URL or local mode)
      const urlRes = await fetch(
        `/api/upload-url?fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`
      );
      if (!urlRes.ok) throw new Error("获取上传链接失败");
      const config = await urlRes.json();

      let s3Key: string;
      let publicUrl: string;

      if (config.mode === "local") {
        // Local storage — POST file directly
        const formData = new FormData();
        formData.append("file", file);
        const localRes = await fetch("/api/upload-url", {
          method: "POST",
          body: formData,
        });
        if (!localRes.ok) throw new Error("上传失败");
        const localData = await localRes.json();
        s3Key = localData.s3Key;
        publicUrl = localData.publicUrl;
      } else {
        // S3 mode — PUT to pre-signed URL
        const uploadRes = await fetch(config.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!uploadRes.ok) throw new Error("上传失败");
        s3Key = config.s3Key;
        publicUrl = config.publicUrl;
      }

      // Register image with project
      const imgRes = await fetch(`/api/products/${projectId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          originalUrl: publicUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      if (!imgRes.ok) throw new Error("关联图片失败");
      const { productImage } = await imgRes.json();
      onImageChange(productImage);
    } catch (err) {
      console.error("上传失败", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {currentImage ? (
        /* Uploaded state */
        <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100">
          <img
            src={currentImage.originalUrl}
            alt={currentImage.fileName}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-white transition-colors shadow-sm"
          >
            {uploading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            更换图片
          </button>
        </div>
      ) : (
        /* Empty state */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-3 aspect-square rounded-xl border-2 border-dashed border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 size={28} className="animate-spin text-zinc-400" />
              <span className="text-sm text-zinc-400">上传中...</span>
            </>
          ) : (
            <>
              <Upload size={28} className="text-zinc-300" />
              <div className="text-center">
                <p className="text-sm text-zinc-500">拖拽或点击上传产品图片</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  PNG / JPG / WebP
                </p>
              </div>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
