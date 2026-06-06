"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Image, Download, Trash2, Loader2, X } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { toast } from "sonner";

interface AssetImage {
  id: string;
  url: string;
  promptUsed: string | null;
  project: {
    title: string;
    targetPlatform: string | null;
  };
}

export default function AssetsPage() {
  const { t } = useT();
  const [images, setImages] = useState<AssetImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchImages = useCallback(async () => {
    const res = await fetch("/api/assets");
    if (res.ok) {
      const data = await res.json();
      setImages(data.images || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === images.length ? new Set() : new Set(images.map((img) => img.id))
    );
  }

  function clearSelection() { setSelected(new Set()); }

  async function handleBatchDelete() {
    setBatchLoading(true);
    try {
      await fetch("/api/assets/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: [...selected] }),
      });
      setSelected(new Set());
      await fetchImages();
      toast.success(`Deleted ${selectedCount} images`);
    } catch { toast.error("Delete failed"); }
    finally { setBatchLoading(false); setDeleteDialogOpen(false); }
  }

  async function handleBatchDownload() {
    const selectedImages = images.filter((img) => selected.has(img.id));
    let failed = 0;
    for (const img of selectedImages) {
      try {
        const res = await fetch(img.url);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `flashant-${img.id.slice(0, 8)}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch { failed++; }
    }
    if (failed > 0) {
      toast.warning(`Downloaded ${selectedImages.length - failed} images, ${failed} failed`);
    } else {
      toast.success(`Downloaded ${selectedImages.length} images`);
    }
  }

  async function handleSingleDownload(img: AssetImage) {
    try {
      const res = await fetch(img.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `flashant-${img.id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Download failed"); }
  }

  const selectedCount = selected.size;
  const selectionMode = selectedCount > 0;

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <div className="h-7 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-md" />
          <div className="h-4 w-32 bg-zinc-50 dark:bg-zinc-700/50 rounded-md mt-1.5" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb items={[{ label: t("assets.title") }]} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300 tracking-tight">{t("assets.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("assets.subtitle")} · {images.length} {t("assets.imageCount")}
          </p>
        </div>
      </div>

      {images.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <Image size={40} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t("assets.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("assets.emptyDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Toolbar */}
          <div
            className={`flex items-center gap-3 mb-5 px-3 py-2 rounded-lg border transition-colors ${
              selectionMode
                ? "bg-brand-50/70 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800"
                : "bg-transparent border-transparent"
            }`}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={selectedCount === images.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {selectedCount === images.length ? t("batch.deselect") : t("batch.selectAll")}
              </span>
            </label>

            {selectionMode && (
              <>
                <div className="w-px h-4 bg-brand-200 dark:bg-brand-700" />
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 tabular-nums min-w-[3ch]">
                  {selectedCount}
                </span>

                <div className="flex-1" />

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleBatchDownload}
                    disabled={batchLoading}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-white/80 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Download size={12} />
                    {t("assets.download")}
                  </button>
                  <div className="w-px h-4 bg-brand-200 dark:bg-brand-700" />
                  <button
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={batchLoading}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                    {t("batch.delete")}
                  </button>
                  <button
                    onClick={clearSelection}
                    className="ml-1 p-1 rounded-md hover:bg-brand-100 dark:hover:bg-brand-800/30 transition-colors cursor-pointer"
                  >
                    <X size={14} className="text-brand-500 dark:text-brand-400" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img) => {
              const isSelected = selected.has(img.id);
              return (
                <div
                  key={img.id}
                  className={`group relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border transition-all ${
                    isSelected ? "ring-2 ring-brand-500 dark:ring-brand-400 border-brand-300 dark:border-brand-600" : "border-zinc-100 dark:border-zinc-700"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.promptUsed ?? "Generated"}
                    className="w-full h-full object-cover"
                  />

                  {/* Checkbox overlay */}
                  <div
                    className={`absolute top-2 left-2 z-20 transition-all duration-100 ${
                      isSelected
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
                    }`}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-md bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/80 dark:border-zinc-600"
                    >
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(img.id)} />
                    </div>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <span className="text-[10px] text-white/80 truncate max-w-[55%]">
                        {img.project.title || t("assets.unnamed")}
                      </span>
                      <button
                        onClick={() => handleSingleDownload(img)}
                        className="inline-flex items-center gap-1 rounded-md bg-white/90 dark:bg-zinc-700/90 px-2 py-1 text-[10px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                      >
                        <Download size={10} />
                        {t("assets.download")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("batch.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("batch.confirmDeleteDescMulti")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={batchLoading}
              className="cursor-pointer"
            >
              {t("batch.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              disabled={batchLoading}
              className="cursor-pointer"
            >
              {batchLoading ? t("batch.deleting") : t("batch.confirmDeleteBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
