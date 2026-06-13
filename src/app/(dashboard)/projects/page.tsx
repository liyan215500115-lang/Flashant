"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Image, Trash2, RefreshCw, Send, Package, Layers, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/i18n-provider";

type ProjectStatus = "DRAFT" | "GENERATING" | "GENERATED" | "REVIEW" | "APPROVED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 border-zinc-200",
  GENERATING: "bg-holo-50 text-holo-600 border-holo-200",
  GENERATED: "bg-emerald-50 text-emerald-600 border-emerald-200",
  REVIEW: "bg-amber-50 text-amber-600 border-amber-200",
  APPROVED: "bg-blue-50 text-blue-600 border-blue-200",
  PUBLISHING: "bg-purple-50 text-purple-600 border-purple-200 animate-pulse",
  PUBLISHED: "bg-emerald-50 text-emerald-600 border-emerald-200",
  FAILED: "bg-red-50 text-red-600 border-red-200",
};

interface Project {
  id: string; title: string; status: string; errorMessage: string | null;
  productImages: { originalUrl: string }[];
  generatedImages: { id: string; url: string; status: string }[];
  promptTemplate: { name: string; nameZh: string } | null;
}

export default function ProductsPage() {
  const { t } = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Optimistic delete — hide immediately, undo if API fails
  async function handleDelete(id: string) {
    const snapshot = [...projects];
    setDeletingIds((prev) => new Set(prev).add(id));

    // Animate out: wait 150ms then remove
    await new Promise((r) => setTimeout(r, 100));
    setProjects((prev) => prev.filter((p) => p.id !== id));

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setProjects(snapshot);
        toast.error("Delete failed — project restored");
      }
    } catch {
      setProjects(snapshot);
      toast.error("Network error — project restored");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleRegenerate(id: string) {
    toast.success("Regeneration queued");
    try {
      await fetch("/api/projects/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate", ids: [id] }),
      });
      fetchProjects();
    } catch { toast.error(t("error.loadFailed")); }
  }

  async function handlePublish(id: string) {
    window.location.href = `/projects/${id}/publish`;
  }

  const filtered = projects
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.promptTemplate?.name?.toLowerCase().includes(q) || p.promptTemplate?.nameZh?.includes(q);
    })
    .filter((p) => !statusFilter || p.status === statusFilter);
  const displayProjects = sortBy === "oldest" ? [...filtered].reverse() : filtered;

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="h-7 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-md mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-100 dark:border-zinc-700 p-3 animate-pulse">
              <div className="aspect-[4/3] rounded-lg bg-zinc-50 dark:bg-zinc-700/50 mb-3" />
              <div className="h-4 w-2/3 bg-zinc-50 dark:bg-zinc-700/50 rounded mb-2" />
              <div className="h-3 w-1/3 bg-zinc-50 dark:bg-zinc-700/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300 tracking-tight">{t("products.title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {projects.length > 0 ? t("products.total").replace("{count}", String(filtered.length)) : t("products.createPrompt")}
          </p>
        </div>
        <Link href="/studio">
          <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm rounded-xl">
            <Sparkles size={16} />
            {t("products.newProject")}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <input type="text" placeholder={t("products.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-52 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 transition-all" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs text-zinc-600 transition-all">
            <option value="">{t("products.allStatus")}</option>
            {["DRAFT","GENERATING","GENERATED","REVIEW","PUBLISHED","FAILED"].map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "newest"|"oldest")}
            className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs text-zinc-600 transition-all">
            <option value="newest">{t("products.sortNewest")}</option>
            <option value="oldest">{t("products.sortOldest")}</option>
          </select>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <Card className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <Package size={36} className="text-zinc-300 dark:text-zinc-600" strokeWidth={1} />
            <div className="text-center">
              <p className="text-base font-semibold text-zinc-600 dark:text-zinc-300">{t("workspace.emptyTitle")}</p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">{t("workspace.emptyDesc")}</p>
            </div>
            <Link href="/studio">
              <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm rounded-xl mt-1">
                <Sparkles size={16} />{t("workspace.createFirst")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Project grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 [&>*:first-child]:xl:col-span-2 [&>*:first-child]:xl:row-span-2">
        {filtered.length === 0 && projects.length > 0 ? (
          <div className="col-span-full text-center py-12 text-sm text-zinc-400">{t("products.noResults")}</div>
        ) : (
          displayProjects.map((project, idx) => {
            const s = STATUS_STYLE[project.status as ProjectStatus] ?? STATUS_STYLE.DRAFT;
            const thumbnail = project.productImages[0]?.originalUrl || project.generatedImages[0]?.url || null;
            const isDeleting = deletingIds.has(project.id);

            return (
              <div key={project.id} className={`group/card relative rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 hover:shadow-md transition-all duration-200 ${isDeleting ? "opacity-40 scale-95 pointer-events-none" : ""} ${idx === 0 ? "xl:aspect-auto" : ""}`}>
                <Link href={`/projects/${project.id}`} className="block p-3">
                  <div className="aspect-[4/3] rounded-xl mb-3 overflow-hidden bg-zinc-50 dark:bg-zinc-700/30 relative">
                    {thumbnail ? (
                      <img src={thumbnail} alt={project.title} className="w-full h-full object-cover group-hover/card:scale-[1.03] transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Image size={32} className="text-zinc-200 dark:text-zinc-600" strokeWidth={1} /></div>
                    )}
                    <span className={`absolute top-2.5 left-2.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s}`}>
                      {t(`status.${project.status}`)}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{project.title || "Untitled"}</h3>
                  {project.promptTemplate ? (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{project.promptTemplate.nameZh || project.promptTemplate.name}</p>
                  ) : project.status === "FAILED" && project.errorMessage ? (
                    <p className="text-[11px] text-red-500 truncate">{project.errorMessage}</p>
                  ) : (
                    <p className="text-[11px] text-zinc-300 dark:text-zinc-600">{t("batch.noTemplate")}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 text-[11px] text-zinc-400">
                    <Layers size={11} />{project.productImages.length}
                    <span className="text-zinc-200">·</span>
                    <Image size={11} />{project.generatedImages.length}
                  </div>
                </Link>

                {/* Hover actions */}
                <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  {project.status === "GENERATED" && (
                    <button onClick={(e) => { e.preventDefault(); handlePublish(project.id); }}
                      className="p-1.5 rounded-lg bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/80 dark:border-zinc-600 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer" title="Publish">
                      <Send size={13} />
                    </button>
                  )}
                  <button onClick={(e) => { e.preventDefault(); handleRegenerate(project.id); }}
                    className="p-1.5 rounded-lg bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/80 dark:border-zinc-600 text-zinc-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors cursor-pointer" title="Regenerate">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); handleDelete(project.id); }}
                    className="p-1.5 rounded-lg bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/80 dark:border-zinc-600 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
