"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Image,
  Trash2,
  RefreshCw,
  Send,
  X,
  Package,
  Layers,
} from "lucide-react";
import { useT } from "@/components/i18n-provider";

/* ─────── Status config ─────── */

type ProjectStatus =
  | "DRAFT" | "GENERATING" | "GENERATED" | "REVIEW"
  | "APPROVED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

const STATUS_STYLE: Record<ProjectStatus, { dot: string; badge: string }> = {
  DRAFT:         { dot: "bg-zinc-300", badge: "bg-zinc-100 text-zinc-600" },
  GENERATING:    { dot: "bg-holo-500 animate-pulse", badge: "bg-holo-50 text-holo-600 border-holo-200" },
  GENERATED:     { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  REVIEW:        { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-600 border-amber-200" },
  APPROVED:      { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-600 border-blue-200" },
  PUBLISHING:    { dot: "bg-purple-500 animate-pulse", badge: "bg-purple-50 text-purple-600 border-purple-200" },
  PUBLISHED:     { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  FAILED:        { dot: "bg-red-500", badge: "bg-red-50 text-red-600 border-red-200" },
};

/* ─────── Types ─────── */

interface Project {
  id: string;
  title: string;
  status: string;
  errorMessage: string | null;
  productImages: { originalUrl: string }[];
  generatedImages: { id: string; url: string; status: string }[];
  promptTemplate: { name: string; nameZh: string } | null;
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function ProductsPage() {
  const { t } = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string }>({ ids: [], label: "" });
  const [batchLoading, setBatchLoading] = useState(false);

  /* ── Data ── */

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  /* ── Selection ── */

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === projects.length ? new Set() : new Set(projects.map((p) => p.id))
    );
  }

  function clearSelection() { setSelected(new Set()); }

  /* ── Delete ── */

  function confirmDelete(ids: string[], label: string) {
    setDeleteTarget({ ids, label });
    setDeleteDialogOpen(true);
  }

  async function executeDelete() {
    setBatchLoading(true);
    try {
      if (deleteTarget.ids.length === 1) {
        await fetch(`/api/products/${deleteTarget.ids[0]}`, { method: "DELETE" });
      } else {
        await fetch("/api/products/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", ids: deleteTarget.ids }),
        });
      }
      setSelected(new Set());
      await fetchProjects();
    } catch { /* best-effort */ }
    finally { setBatchLoading(false); setDeleteDialogOpen(false); }
  }

  /* ── Actions ── */

  async function batchAction(action: "publish" | "regenerate") {
    setBatchLoading(true);
    try {
      await fetch("/api/products/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [...selected] }),
      });
      setSelected(new Set());
      await fetchProjects();
    } catch { /* best-effort */ }
    finally { setBatchLoading(false); }
  }

  async function singleAction(id: string, action: "publish" | "regenerate") {
    setBatchLoading(true);
    try {
      await fetch("/api/products/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [id] }),
      });
      await fetchProjects();
    } catch { /* best-effort */ }
    finally { setBatchLoading(false); }
  }

  /* ── Derived ── */

  const selectedCount = selected.size;
  const selectionMode = selectedCount > 0;

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /* ── Loading skeleton ── */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-7 w-20 bg-zinc-100 rounded-md" />
            <div className="h-4 w-28 bg-zinc-50 rounded-md mt-1.5" />
          </div>
          <div className="h-9 w-28 bg-zinc-100 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-100 p-3">
              <div className="aspect-[4/3] rounded-lg bg-zinc-50 mb-3" />
              <div className="h-4 w-2/3 bg-zinc-50 rounded mb-2" />
              <div className="h-3 w-1/3 bg-zinc-50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /* ── Render ── */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 tracking-tight">
            {t("products.title")}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {projects.length > 0
              ? t("products.total").replace("{count}", String(projects.length))
              : t("products.createPrompt")}
          </p>
        </div>
        <Link href="/products/new">
          <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm">
            <Plus size={16} strokeWidth={2} />
            {t("products.newProject")}
          </Button>
        </Link>
      </div>

      {/* ── Toolbar ── */}
      {projects.length > 0 && (
        <div
          className={`flex items-center gap-3 mb-5 px-3 py-2 rounded-lg border transition-colors ${
            selectionMode
              ? "bg-brand-50/70 border-brand-200"
              : "bg-transparent border-transparent"
          }`}
        >
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={selectedCount === projects.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-zinc-500">
              {selectedCount === projects.length
                ? t("batch.deselect")
                : t("batch.selectAll")}
            </span>
          </label>

          {selectionMode && (
            <>
              <div className="w-px h-4 bg-brand-200" />
              <span className="text-xs font-semibold text-brand-700 tabular-nums min-w-[3ch]">
                {selectedCount}
              </span>

              <div className="flex-1" />

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => batchAction("regenerate")}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-zinc-600 hover:text-brand-700 hover:bg-white/80 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw size={12} strokeWidth={2} />
                  {t("batch.regenerate")}
                </button>
                <button
                  onClick={() => batchAction("publish")}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-zinc-600 hover:text-emerald-700 hover:bg-white/80 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Send size={12} strokeWidth={2} />
                  {t("batch.publish")}
                </button>
                <div className="w-px h-4 bg-brand-200" />
                <button
                  onClick={() => confirmDelete([...selected], t("batch.confirmDeleteDescMulti"))}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Trash2 size={12} strokeWidth={2} />
                  {t("batch.delete")}
                </button>
                <button
                  onClick={clearSelection}
                  className="ml-1 p-1 rounded-md hover:bg-brand-100 transition-colors cursor-pointer"
                >
                  <X size={14} className="text-brand-500" strokeWidth={2} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {projects.length === 0 && (
        <Card className="border-dashed border-zinc-300 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center">
              <Package size={24} className="text-zinc-300" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-zinc-600">
                {t("workspace.emptyTitle")}
              </p>
              <p className="text-sm text-zinc-400 mt-1 max-w-xs">
                {t("workspace.emptyDesc")}
              </p>
            </div>
            <Link href="/products/new">
              <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm mt-1">
                <Plus size={16} strokeWidth={2} />
                {t("workspace.createFirst")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((project) => {
          const isSelected = selected.has(project.id);
          const s = STATUS_STYLE[project.status as ProjectStatus] ?? STATUS_STYLE.DRAFT;
          const thumbnailUrl =
            project.productImages[0]?.originalUrl ||
            project.generatedImages[0]?.url ||
            null;

          return (
            <div
              key={project.id}
              className={`group/card relative rounded-xl border bg-white transition-all duration-150 ${
                isSelected
                  ? "ring-2 ring-brand-500 border-brand-300 shadow-md"
                  : "border-zinc-200/70 hover:border-zinc-300 hover:shadow-sm"
              }`}
            >
              {/* ── Checkbox ── */}
              <div
                className={`absolute top-2.5 left-2.5 z-20 transition-all duration-100 ${
                  isSelected
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-90 group-hover/card:opacity-100 group-hover/card:scale-100"
                }`}
              >
                <div
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  className="p-1 rounded-md bg-white shadow-sm border border-zinc-200/80"
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(project.id)} />
                </div>
              </div>

              {/* ── Quick actions ── */}
              <div
                className={`absolute top-2.5 right-2.5 z-20 flex items-center gap-1 transition-all duration-100 ${
                  isSelected
                    ? "opacity-0 pointer-events-none"
                    : "opacity-0 group-hover/card:opacity-100"
                }`}
              >
                {project.status === "GENERATED" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); singleAction(project.id, "publish"); }}
                    disabled={batchLoading}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white shadow-sm border border-zinc-200/80 text-[11px] font-medium text-zinc-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Send size={11} strokeWidth={2} />
                    {t("batch.publishSingle")}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); confirmDelete([project.id], t("batch.confirmDeleteDescSingle")); }}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white shadow-sm border border-zinc-200/80 text-[11px] font-medium text-zinc-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Trash2 size={11} strokeWidth={2} />
                  {t("batch.deleteSingle")}
                </button>
              </div>

              {/* ── Card body ── */}
              <Link href={`/products/${project.id}`} className="block p-3">
                <div className="relative aspect-[4/3] rounded-lg mb-3 overflow-hidden bg-zinc-50">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={32} className="text-zinc-200" strokeWidth={1} />
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.badge}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {t(`status.${project.status}`)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-900 truncate leading-snug">
                    {project.title || "Untitled"}
                  </h3>

                  {project.promptTemplate ? (
                    <p className="text-[11px] text-zinc-400 truncate">
                      {project.promptTemplate.nameZh || project.promptTemplate.name}
                    </p>
                  ) : project.status === "FAILED" && project.errorMessage ? (
                    <p className="text-[11px] text-red-500 truncate">{project.errorMessage}</p>
                  ) : (
                    <p className="text-[11px] text-zinc-300">{t("batch.noTemplate")}</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                      <Layers size={11} strokeWidth={1.5} />
                      {project.productImages.length}
                    </span>
                    <span className="text-zinc-200">·</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                      <Image size={11} strokeWidth={1.5} />
                      {project.generatedImages.length}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("batch.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>{deleteTarget.label}</DialogDescription>
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
              onClick={executeDelete}
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
