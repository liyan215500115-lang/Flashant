"use client";

import { useState, useRef } from "react";
import { Upload, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { toast } from "sonner";

interface ProductImage {
  id: string;
  originalUrl: string;
  fileName: string;
  mimeType: string;
}

interface ImageUploadZoneProps {
  projectId: string | null;
  currentImage: ProductImage | null;
  onImageChange: (image: ProductImage) => void;
  onAccessoryUpload?: (image: ProductImage) => void;
  allImages?: ProductImage[];
  accessoryImages?: ProductImage[];
  maxFiles?: number;
  className?: string;
}

export function ImageUploadZone({
  projectId,
  currentImage,
  onImageChange,
  onAccessoryUpload,
  allImages = [],
  accessoryImages = [],
  maxFiles = 10,
  className,
}: ImageUploadZoneProps) {
  const { t } = useT();
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  async function uploadFile(file: File): Promise<ProductImage | null> {
    if (!file.type.startsWith("image/")) return null;

    try {
      const urlRes = await fetch(
        `/api/upload-url?fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`
      );
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const config = await urlRes.json();

      let s3Key: string;
      let publicUrl: string;

      if (config.mode === "local") {
        const formData = new FormData();
        formData.append("file", file);
        const localRes = await fetch("/api/upload-url", {
          method: "POST",
          body: formData,
        });
        if (!localRes.ok) throw new Error("Upload failed");
        const localData = await localRes.json();
        s3Key = localData.s3Key;
        publicUrl = localData.publicUrl;
      } else {
        // Upload to R2 with up to 2 retries
        let lastErr: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 30_000);
            const uploadRes = await fetch(config.uploadUrl, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type },
              signal: ctrl.signal,
            });
            clearTimeout(timeout);
            if (uploadRes.ok) {
              lastErr = null;
              break;
            }
            lastErr = new Error(`Upload failed (${uploadRes.status})`);
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error("Network error");
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
        }
        if (lastErr) throw lastErr;
        s3Key = config.s3Key;
        publicUrl = config.publicUrl;
      }

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
      if (!imgRes.ok) {
        const err = await imgRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to link image");
      }
      const { productImage } = await imgRes.json();
      return productImage as ProductImage;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
      return null;
    }
  }

  async function handleFiles(files: FileList, target?: (img: ProductImage) => void) {
    const cb = target ?? onImageChange;
    const fileArray = Array.from(files).slice(0, maxFiles);
    setError("");

    const oversized = fileArray.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(
        t("error.fileTooLarge").replace("{size}", `${(oversized.size / 1024 / 1024).toFixed(1)}MB`) +
          ` (${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB max)`
      );
      return;
    }

    setUploading(true);
    setUploadCount(0);

    for (let i = 0; i < fileArray.length; i++) {
      const image = await uploadFile(fileArray[i]);
      if (image) { setUploadCount((c) => c + 1); cb(image); }
    }

    setUploading(false);
  }

  // ── Drag-and-drop handlers ──────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }

  const displayImages = allImages.length > 0 ? allImages : currentImage ? [currentImage] : [];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Size limit error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {currentImage ? (
        <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img
            src={currentImage.originalUrl}
            alt={currentImage.fileName}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-zinc-700/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-600 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-600 transition-colors shadow-sm"
          >
            {uploading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {uploading
              ? t("generate.uploadingProgress").replace("{count}", String(uploadCount))
              : t("generate.changeImage")}
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 aspect-square rounded-xl border-2 border-dashed transition-all cursor-pointer",
            dragOver
              ? "border-zinc-400 dark:border-zinc-400 bg-zinc-100 dark:bg-zinc-700/50 scale-[1.02]"
              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={28} className="animate-spin text-zinc-400 dark:text-zinc-500" />
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                {t("generate.uploadingProgress").replace("{count}", String(uploadCount))}
              </span>
            </>
          ) : (
            <>
              <Upload size={28} className={cn(
                "transition-colors",
                dragOver ? "text-zinc-500 dark:text-zinc-300" : "text-zinc-300 dark:text-zinc-600"
              )} />
              <div className="text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {dragOver ? "松开以上传" : t("generate.uploadZone")}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {t("generate.uploadHintBatch").replace("{max}", String(maxFiles))}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {displayImages.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onImageChange(img)}
              className={cn(
                "shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                currentImage?.id === img.id
                  ? "border-brand-600 ring-1 ring-brand-600/20"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
              )}
            >
              <img
                src={img.originalUrl}
                alt={img.fileName}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Accessory upload area */}
      {currentImage && onAccessoryUpload && (
        <div className="pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
          <p className="text-[10px] text-zinc-400 mb-1.5">配件 / 赠品</p>
          {accessoryImages.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-1.5">
              {accessoryImages.map((img) => (
                <div key={img.id} className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-zinc-200 relative">
                  <img src={img.originalUrl} alt={img.fileName} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { inputRef.current?.click(); }}
            className="w-full py-1.5 rounded-lg border border-dashed border-zinc-300 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 transition-colors cursor-pointer">
            + 上传配件照片
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            if (currentImage && onAccessoryUpload) {
              // If main image already exists, treat as accessory upload
              handleFiles(files, onAccessoryUpload);
            } else {
              // First upload = main product image
              handleFiles(files, onImageChange);
            }
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
