import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { getStageIndex, getTotalStages } from "@/lib/pipeline";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

const ACTIVE_STATUSES = [
  "PARSING", "SCRIPTING", "GENERATING_IMAGES", "GENERATING_VIDEO",
  "GENERATING_AUDIO", "REVIEW", "APPROVED", "PUBLISHING",
];

const STATUS_LABELS: Record<string, string> = {
  PARSING: "解析中", SCRIPTING: "脚本生成中", GENERATING_IMAGES: "图片生成中",
  GENERATING_VIDEO: "视频生成中", GENERATING_AUDIO: "音频合成中",
  REVIEW: "待审核", APPROVED: "已审核", PUBLISHING: "发布中",
  PUBLISHED: "已发布", FAILED: "失败",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  if (status === "FAILED") return <Badge variant="destructive">{label}</Badge>;
  if (status === "PUBLISHED") return <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">{label}</Badge>;
  if (status === "REVIEW" || status === "APPROVED" || status === "PUBLISHING") return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="default">{label}</Badge>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "上午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { status: statusFilter } = await searchParams;

  const projects = await db.videoProject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const userName = (session.user as { name?: string }).name || "用户";

  const activeCount = projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length;
  const reviewCount = projects.filter((p) => p.status === "REVIEW").length;
  const publishedCount = projects.filter((p) => p.status === "PUBLISHED").length;
  const failedCount = projects.filter((p) => p.status === "FAILED").length;

  const filtered = statusFilter
    ? projects.filter((p) => {
        if (statusFilter === "active") return ACTIVE_STATUSES.includes(p.status);
        if (statusFilter === "published") return p.status === "PUBLISHED";
        return p.status === statusFilter.toUpperCase();
      })
    : projects;

  const recentProjects = filtered.slice(0, 9);

  const today = new Date();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 星期${weekdays[today.getDay()]}`;

  const tabs = [
    { key: "", label: "全部", count: projects.length },
    { key: "active", label: "进行中", count: activeCount },
    { key: "REVIEW", label: "待审核", count: reviewCount },
    { key: "PUBLISHED", label: "已完成", count: publishedCount },
    { key: "FAILED", label: "失败", count: failedCount },
  ];

  return (
    <div className="max-w-[1120px] mx-auto">
      {/* Compact top bar */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {getGreeting()}，{userName}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            一键闪象，万象更新 · {dateStr}
          </p>
        </div>
        <Link href="/projects/new">
          <Button variant="default" size="sm">
            <Plus size={16} className="mr-1.5" />
            新建视频
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 mb-6 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {tabs.map((tab) => {
          const isActive =
            (tab.key === "" && !statusFilter) || tab.key === statusFilter;
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/?status=${tab.key}` : "/"}
              className="relative px-3 py-2.5 text-sm font-medium transition-colors hover:text-foreground"
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                borderBottom: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {tab.label}
              <span
                className="ml-1.5 text-xs"
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  opacity: 0.7,
                }}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Project grid or empty state */}
      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
              <span className="text-3xl">🎬</span>
            </div>
            <div className="max-w-sm">
              <h2 className="text-lg font-semibold">开始您的第一个 AI 视频</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                上传商品图片，闪象将自动生成分镜脚本、场景图片、视频和配音
              </p>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>① 上传商品图</span>
              <span>→</span>
              <span>② AI 自动生成</span>
              <span>→</span>
              <span>③ 下载视频</span>
            </div>
            <Link href="/projects/new">
              <Button variant="default" size="lg">创建第一个项目</Button>
            </Link>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">暂无符合筛选条件的项目</p>
          <Link href="/" className="text-sm text-accent hover:underline mt-2 inline-block">
            查看全部项目
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recentProjects.map((p) => {
              const stageIdx = getStageIndex(p.status);
              const total = getTotalStages();
              const progressPct = Math.round((stageIdx / (total - 1)) * 100);
              const isActive = ACTIVE_STATUSES.includes(p.status);
              const isPublished = p.status === "PUBLISHED";

              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="group block">
                  <Card className="group-hover:ring-foreground/20 transition-all overflow-hidden h-full">
                    <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                      {p.productImage ? (
                        <img
                          src={p.productImage}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-4xl opacity-30">📦</span>
                        </div>
                      )}
                      <div className="absolute top-2.5 right-2.5">
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <h3 className="text-sm font-medium truncate mb-2">
                        {p.productTitle || "未命名项目"}
                      </h3>
                      <div className="flex items-center justify-between gap-2">
                        {isActive && (
                          <div className="flex items-center gap-2 flex-1">
                            <Progress value={progressPct} className="flex-1" />
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {progressPct}%
                            </span>
                          </div>
                        )}
                        {isPublished && (
                          <span className="text-xs text-emerald-600 font-medium">已完成</span>
                        )}
                        {p.status === "FAILED" && (
                          <span className="text-xs text-destructive font-medium">失败</span>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          {filtered.length > 9 && (
            <div className="text-center mt-6">
              <Link
                href={statusFilter ? `/projects?status=${statusFilter}` : "/projects"}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                查看全部 {filtered.length} 个项目 →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
