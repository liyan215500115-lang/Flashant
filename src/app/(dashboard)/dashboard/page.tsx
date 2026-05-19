import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Package, Image, ArrowRight, ChevronRight } from "lucide-react";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";

function resolve(path: string, messages: Record<string, unknown>): string {
  const keys = path.split(".");
  let val: unknown = messages;
  for (const k of keys) {
    if (val && typeof val === "object" && k in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[k];
    } else {
      return path;
    }
  }
  return typeof val === "string" ? val : path;
}

async function getT() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const messages = locale === "zh" ? zh : en;
  return (key: string) => resolve(key, messages as unknown as Record<string, unknown>);
}

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
    db.generatedImage.count({
      where: { project: { userId }, status: "SUCCEEDED" },
    }),
    db.subscription.findUnique({ where: { userId } }),
    db.imageProject.count({ where: { userId } }),
  ]);

  const tier = subscription?.planTier ?? "FREE";

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      {/* ── Greeting ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-900 tracking-tight">
          {t("dashboard.hello")}，{session.user?.name || "User"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">{t("dashboard.tagline")}</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-zinc-200/70 shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-700">
              <Package size={18} strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl font-bold text-zinc-900 tabular-nums">{totalProjects}</div>
              <div className="text-xs text-zinc-500">{t("dashboard.totalProjects")}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/70 shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-holo-50 text-holo-600">
              <Image size={18} strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl font-bold text-zinc-900 tabular-nums">{generatedCount}</div>
              <div className="text-xs text-zinc-500">{t("dashboard.generatedImages")}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/70 shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gold-50 text-gold-600">
              <Sparkles size={18} strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl font-bold text-zinc-900">
                {tier === "FREE" ? t("dashboard.free") : tier}
              </div>
              <div className="text-xs text-zinc-500">{t("dashboard.currentPlan")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick actions ── */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/studio">
          <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm">
            <Sparkles size={15} strokeWidth={2} />
            {t("dashboard.enterStudio")}
          </Button>
        </Link>
        <Link href="/products">
          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
            {t("dashboard.viewAllProjects")}
            <ArrowRight size={14} strokeWidth={1.5} />
          </Button>
        </Link>
      </div>

      {/* ── Recent projects ── */}
      {projects.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-zinc-800 mb-4">
            {t("dashboard.recentProjects")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/products/${project.id}`}>
                <Card className="group/card border-zinc-200/70 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer h-full">
                  <CardContent className="p-3">
                    <div className="aspect-[4/3] rounded-lg bg-zinc-50 mb-3 overflow-hidden">
                      {project.productImages[0]?.originalUrl ? (
                        <img
                          src={project.productImages[0].originalUrl}
                          alt={project.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
                        />
                      ) : project.generatedImages[0]?.url ? (
                        <img
                          src={project.generatedImages[0].url}
                          alt="Generated"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image size={28} className="text-zinc-200" strokeWidth={1} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-zinc-900 truncate flex-1">
                        {project.title || "Untitled"}
                      </h3>
                      <Badge variant="secondary" className="text-[10px] ml-2 font-medium">
                        {t(`status.${project.status}`)}
                      </Badge>
                    </div>
                    {project.promptTemplate && (
                      <p className="text-[11px] text-zinc-400 truncate">
                        {project.promptTemplate.nameZh || project.promptTemplate.name}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-zinc-400">
                        {project.productImages.length} {t("workspace.images")} · {project.generatedImages.length} {t("workspace.results")}
                      </span>
                      <ChevronRight size={14} className="text-zinc-300 group-hover/card:text-zinc-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {projects.length === 0 && (
        <Card className="border-dashed border-zinc-300 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-5">
            <Sparkles size={36} className="text-zinc-300" strokeWidth={1} />
            <div className="text-center">
              <h3 className="text-base font-semibold text-zinc-600">
                {t("dashboard.noProjects")}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                {t("dashboard.noProjectsDesc")}
              </p>
            </div>
            <Link href="/studio">
              <Button className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 shadow-sm mt-1">
                <Sparkles size={15} strokeWidth={2} />
                {t("dashboard.startFirstProject")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
