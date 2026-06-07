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
import { toast } from "sonner";
import { useT } from "@/components/i18n-provider";

/* ─────── Status config ─────── */

type ProjectStatus =
  | "DRAFT" | "GENERATING" | "GENERATED" | "REVIEW"
  | "APPROVED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

const STATUS_STYLE: Record<ProjectStatus, { dot: string; badge: string }> = {
  DRAFT:         { dot: "bg-zinc-300 dark:bg-zinc-500", badge: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300" },
  GENERATING:    { dot: "bg-holo-500 animate-pulse", badge: "bg-holo-50 dark:bg-holo-900/20 text-holo-600 dark:text-holo-400 border-holo-200 dark:border-holo-800" },
  GENERATED:     { dot: "bg-emerald-500", badge: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  REVIEW:        { dot: "bg-amber-500", badge: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  APPROVED:      { dot: "bg-blue-500", badge: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  PUBLISHING:    { dot: "bg-purple-500 animate-pulse", badge: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
  PUBLISHED:     { dot: "bg-emerald-500", badge: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  FAILED:        { dot: "bg-red-500", badge: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800" },
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

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
    } catch { toast.error(t("error.loadFailed")); }
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
    } catch { toast.error(t("error.loadFailed")); }
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
    } catch { toast.error(t("error.loadFailed")); }
    finally { setBatchLoading(false); }
  }

  /* ── Derived ── */

  const selectedCount = selected.size;
  const selectionMode = selectedCount > 0;

  // Search, filter, sort
  const filtered = projects
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.promptTemplate?.name?.toLowerCase().includes(q) ||
        p.promptTemplate?.nameZh?.includes(q)
      );
    })
    .filter((p) => {
      if (!statusFilter) return true;
      return p.status === statusFilter;
    })
    .sort((a, b) => {
      if (sortBy === "oldest") return 0; // API returns newest-first, keep as-is
      return 0; // API already returns newest-first
    });
  const displayProjects = sortBy === "oldest" ? [...filtered].reverse() : filtered;

  const statusOptions = [
    "", "DRAFT", "GENERATING", "GENERATED", "REVIEW", "PUBLISHED", "FAILED",
  ];

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /* ── Loading skeleton ── */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-7 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-md" />
            <div className="h-4 w-28 bg-zinc-50 dark:bg-zinc-700/50 rounded-md mt-1.5" />
          </div>
          <div className="h-9 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-100 dark:border-zinc-700 p-3">
              <div className="aspect-[4/3] rounded-lg bg-zinc-50 dark:bg-zinc-700/50 mb-3" />
              <div className="h-4 w-2/3 bg-zinc-50 dark:bg-zinc-700/50 rounded mb-2" />
              <div className="h-3 w-1/3 bg-zinc-50 dark:bg-zinc-700/50 rounded" />
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
          <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300 tracking-tight">
            {t("products.title")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {projects.length > 0
              ? t("products.total").replace("{count}", String(filtered.length))
              : t("products.createPrompt")}
          </p>
        </div>
        <Link href="/studio">
          <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm">
            <Plus size={16} strokeWidth={2} />
            {t("products.newProject")}
          </Button>
        </Link>
      </div>

      {/* ── Search / Filter / Sort ── */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            type="text"
            placeholder={t("products.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-52 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-brand-700 dark:focus:border-brand-400 focus:ring-1 focus:ring-brand-700/10"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none focus:border-brand-700 dark:focus:border-brand-400"
          >
            <option value="">{t("products.allStatus")}</option>
            {statusOptions.filter(Boolean).map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
            className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none focus:border-brand-700 dark:focus:border-brand-400"
          >
            <option value="newest">{t("products.sortNewest")}</option>
            <option value="oldest">{t("products.sortOldest")}</option>
          </select>
          {(search || statusFilter) && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {t("products.filterCount").replace("{filtered}", String(filtered.length)).replace("{total}", String(projects.length))}
            </span>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      {projects.length > 0 && (
        <div
          className={`flex items-center gap-3 mb-5 px-3 py-2 rounded-lg border transition-colors ${
            selectionMode
              ? "bg-brand-50/70 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800"
              : "bg-transparent border-transparent"
          }`}
        >
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={selectedCount === projects.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {selectedCount === projects.length
                ? t("batch.deselect")
                : t("batch.selectAll")}
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
                  onClick={() => batchAction("regenerate")}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-white/80 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw size={12} strokeWidth={2} />
                  {t("batch.regenerate")}
                </button>
                <button
                  onClick={() => batchAction("publish")}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-white/80 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Send size={12} strokeWidth={2} />
                  {t("batch.publish")}
                </button>
                <div className="w-px h-4 bg-brand-200 dark:bg-brand-700" />
                <button
                  onClick={() => confirmDelete([...selected], t("batch.confirmDeleteDescMulti"))}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Trash2 size={12} strokeWidth={2} />
                  {t("batch.delete")}
                </button>
                <button
                  onClick={clearSelection}
                  className="ml-1 p-1 rounded-md hover:bg-brand-100 dark:hover:bg-brand-800/30 transition-colors cursor-pointer"
                >
                  <X size={14} className="text-brand-500 dark:text-brand-400" strokeWidth={2} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {projects.length === 0 && (
        <Card className="border-dashed border-zinc-300 dark:border-zinc-600 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
              <Package size={24} className="text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-zinc-600 dark:text-zinc-300">
                {t("workspace.emptyTitle")}
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">
                {t("workspace.emptyDesc")}
              </p>
            </div>
            <Link href="/studio">
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
        {filtered.length === 0 && projects.length > 0 ? (
          <div className="col-span-full text-center py-12 text-sm text-zinc-400 dark:text-zinc-500">
            {t("products.noResults")}
          </div>
        ) : (
          displayProjects.map((project) => {
          const isSelected = selected.has(project.id);
          const s = STATUS_STYLE[project.status as ProjectStatus] ?? STATUS_STYLE.DRAFT;
          const thumbnailUrl =
            project.productImages[0]?.originalUrl ||
            project.generatedImages[0]?.url ||
            null;

          return (
            <div
              key={project.id}
              className={`group/card relative rounded-xl border bg-white dark:bg-zinc-800/50 transition-all duration-150 ${
                isSelected
                  ? "ring-2 ring-brand-500 dark:ring-brand-400 border-brand-300 dark:border-brand-600 shadow-md"
                  : "border-zinc-200/70 dark:border-zinc-700/70 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm"
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
                  className="p-1 rounded-md bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/80 dark:border-zinc-600"
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
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/80 dark:border-zinc-600 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Send size={11} strokeWidth={2} />
                    {t("batch.publishSingle")}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); confirmDelete([project.id], t("batch.confirmDeleteDescSingle")); }}
                  disabled={batchLoading}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/80 dark:border-zinc-600 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Trash2 size={11} strokeWidth={2} />
                  {t("batch.deleteSingle")}
                </button>
              </div>

              {/* ── Card body ── */}
              <Link href={`/products/${project.id}`} className="block p-3">
                <div className="relative aspect-[4/3] rounded-lg mb-3 overflow-hidden bg-zinc-50 dark:bg-zinc-700/50">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={32} className="text-zinc-200 dark:text-zinc-600" strokeWidth={1} />
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
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug">
                    {project.title || "Untitled"}
                  </h3>

                  {project.promptTemplate ? (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                      {project.promptTemplate.nameZh || project.promptTemplate.name}
                    </p>
                  ) : project.status === "FAILED" && project.errorMessage ? (
                    <p className="text-[11px] text-red-500 dark:text-red-400 truncate">{project.errorMessage}</p>
                  ) : (
                    <p className="text-[11px] text-zinc-300 dark:text-zinc-600">{t("batch.noTemplate")}</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                      <Layers size={11} strokeWidth={1.5} />
                      {project.productImages.length}
                    </span>
                    <span className="text-zinc-200 dark:text-zinc-600">·</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                      <Image size={11} strokeWidth={1.5} />
                      {project.generatedImages.length}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          );
        }))}
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
