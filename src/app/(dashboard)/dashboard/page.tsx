import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedGetUrl } from "@/lib/s3";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Package, Image, ArrowRight, ChevronRight, Zap, TrendingUp, Play } from "lucide-react";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";

function resolve(path: string, messages: Record<string, unknown>): string {
  const keys = path.split(".");
  let val: unknown = messages;
  for (const k of keys) {
    if (val && typeof val === "object" && k in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[k];
    } else return path;
  }
  return typeof val === "string" ? val : path;
}

async function getT() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const messages = locale === "zh" ? zh : en;
  return (key: string) => resolve(key, messages as unknown as Record<string, unknown>);
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 border-zinc-200",
  GENERATING: "bg-holo-50 text-holo-600 border-holo-200",
  GENERATED: "bg-emerald-50 text-emerald-600 border-emerald-200",
  FAILED: "bg-red-50 text-red-600 border-red-200",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const t = await getT();

  const [projects, generatedCount, subscription, totalProjects] = await Promise.all([
    db.imageProject.findMany({
      where: { userId },
      include: {
        productImages: { take: 1, orderBy: { sortOrder: "asc" } },
        generatedImages: { where: { status: "SUCCEEDED" }, take: 1 },
        promptTemplate: { select: { name: true, nameZh: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.generatedImage.count({ where: { project: { userId }, status: "SUCCEEDED" } }),
    db.subscription.findUnique({ where: { userId } }),
    db.imageProject.count({ where: { userId } }),
  ]);

  const tier = subscription?.planTier ?? "FREE";
  const usagePercent = tier === "FREE" ? Math.round((generatedCount / 10) * 100) : 0;

  // Resolve presigned URLs
  const resolvedProjects = await Promise.all(
    projects.map(async (p) => ({
      ...p,
      productImages: await Promise.all(
        p.productImages.map(async (img) => {
          if (img.s3Key && (img.s3Key.startsWith("products/") || img.s3Key.startsWith("generated/"))) {
            const signed = await getSignedGetUrl(img.s3Key).catch(() => img.originalUrl);
            return { ...img, originalUrl: signed };
          }
          return img;
        })
      ),
    }))
  );

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      {/* Welcome banner */}
      <div className="mb-8 rounded-2xl bg-brand-900 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.hello")}, {session.user?.name || "User"}</h1>
            <p className="text-sm text-brand-200 mt-1">{t("dashboard.tagline")}</p>
          </div>
          <Link href="/studio">
            <Button className="bg-white text-brand-900 hover:bg-brand-50 cursor-pointer gap-2 rounded-xl shadow-lg shadow-black/20">
              <Sparkles size={16} strokeWidth={2} />
              {t("dashboard.enterStudio")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_0.8fr] gap-3 mb-8">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-5 hover:shadow-md transition-shadow">
          <Package size={18} className="text-brand-700 mb-3" strokeWidth={1.5} />
          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight">{totalProjects}</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{t("dashboard.totalProjects")}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-5 hover:shadow-md transition-shadow">
          <Image size={18} className="text-holo-500 mb-3" strokeWidth={1.5} />
          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight">{generatedCount}</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{t("dashboard.generatedImages")}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Zap size={18} className="text-gold-500" strokeWidth={1.5} />
            {usagePercent > 80 && <TrendingUp size={14} className="text-amber-500" />}
          </div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{tier === "FREE" ? t("dashboard.free") : tier}</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{t("dashboard.currentPlan")}</div>
        </div>
      </div>

      {/* Quick actions + View all */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer rounded-xl">{t("dashboard.viewAllProjects")} <ArrowRight size={14} /></Button>
          </Link>
        </div>
      </div>

      {/* Recent projects */}
      {resolvedProjects.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4">{t("dashboard.recentProjects")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {resolvedProjects.map((project) => {
              const statusClass = STATUS_STYLE[project.status] ?? STATUS_STYLE.DRAFT;
              return (
                <Link key={project.id} href={`/products/${project.id}`} className="group/card block">
                  <div className="rounded-2xl bg-white dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-brand-200 dark:hover:border-zinc-500 hover:shadow-md transition-all duration-300 overflow-hidden">
                    <div className="aspect-[4/3] bg-zinc-50 dark:bg-zinc-700/30 relative overflow-hidden">
                      {project.productImages[0]?.originalUrl ? (
                        <img src={project.productImages[0].originalUrl} alt={project.title} className="w-full h-full object-cover group-hover/card:scale-[1.04] transition-transform duration-500" />
                      ) : project.generatedImages[0]?.url ? (
                        <img src={project.generatedImages[0].url} alt="Generated" className="w-full h-full object-cover group-hover/card:scale-[1.04] transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Image size={32} className="text-zinc-200 dark:text-zinc-600" strokeWidth={1} /></div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusClass}`}>{t(`status.${project.status}`)}</span>
                      </div>
                      {/* Hover: quick actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover/card:opacity-100">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-lg">
                          <Play size={12} /> {t("dashboard.enterStudio")}
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{project.title || "Untitled"}</h3>
                      {project.promptTemplate ? (
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{project.promptTemplate.nameZh || project.promptTemplate.name}</p>
                      ) : (
                        <p className="text-[11px] text-zinc-300 dark:text-zinc-600 mt-0.5">No template</p>
                      )}
                      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-700/50">
                        <span className="text-[11px] text-zinc-400">{project.productImages.length} imgs · {project.generatedImages.length} generated</span>
                        <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover/card:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {resolvedProjects.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Sparkles size={28} className="text-brand-500" strokeWidth={1} />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">{t("dashboard.noProjects")}</h3>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm">{t("dashboard.noProjectsDesc")}</p>
          </div>
          <Link href="/studio">
            <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm mt-2 rounded-xl">
              <Sparkles size={16} />
              {t("dashboard.startFirstProject")}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
