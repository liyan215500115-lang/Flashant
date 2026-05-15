import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStageIndex, getTotalStages } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  PARSING: "解析中",
  SCRIPTING: "脚本生成中",
  GENERATING_IMAGES: "图片生成中",
  GENERATING_VIDEO: "视频生成中",
  GENERATING_AUDIO: "音频合成中",
  REVIEW: "待审核",
  APPROVED: "已审核",
  PUBLISHING: "发布中",
  PUBLISHED: "已发布",
  FAILED: "失败",
};

const ACTIVE_STATUSES = ["PARSING", "SCRIPTING", "GENERATING_IMAGES", "GENERATING_VIDEO", "GENERATING_AUDIO", "REVIEW", "APPROVED", "PUBLISHING"];

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  if (status === "FAILED") return <Badge variant="destructive">{label}</Badge>;
  if (status === "PUBLISHED") return <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">{label}</Badge>;
  if (status === "REVIEW" || status === "APPROVED" || status === "PUBLISHING") return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="default">{label}</Badge>;
}

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const projects = await db.videoProject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const activeCount = projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length;
  const publishedCount = projects.filter((p) => p.status === "PUBLISHED").length;
  const failedCount = projects.filter((p) => p.status === "FAILED").length;

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">项目</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length === 0 ? "创建第一个视频项目，AI 自动生成短视频" : `管理 ${projects.length} 个视频项目`}
          </p>
        </div>
        <Link href="/projects/new">
          <Button variant="default">新建项目</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
              <span className="text-3xl">🎬</span>
            </div>
            <div className="max-w-sm">
              <h2 className="text-lg font-semibold">创建第一个项目</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                上传商品图片，AI 自动生成脚本、场景图、视频和配音，一键发布到抖音和快手
              </p>
            </div>
            <Link href="/projects/new">
              <Button variant="default" size="lg">开始创建</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex gap-6 mb-8 py-3 px-5 rounded-xl bg-card ring-1 ring-foreground/10">
            <StatItem label="全部" value={projects.length} />
            <StatItem label="进行中" value={activeCount} />
            <StatItem label="已发布" value={publishedCount} />
            <StatItem label="失败" value={failedCount} />
          </div>

          {/* Project grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => {
              const stageIdx = getStageIndex(p.status);
              const total = getTotalStages();
              const progressPct = Math.round((stageIdx / (total - 1)) * 100);
              const isActive = ACTIVE_STATUSES.includes(p.status);
              const isFailed = p.status === "FAILED";
              const isPublished = p.status === "PUBLISHED";

              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="group block">
                  <Card className="group-hover:ring-foreground/20 h-full transition-all overflow-hidden">
                    {/* Product image preview */}
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
                      {/* Status overlay */}
                      <div className="absolute top-2.5 right-2.5">
                        <StatusBadge status={p.status} />
                      </div>
                    </div>

                    <CardContent className="p-4">
                      {/* Title */}
                      <h3 className="text-sm font-medium truncate mb-2">
                        {p.productTitle || "未命名项目"}
                      </h3>

                      {/* Progress or status */}
                      <div className="flex items-center justify-between gap-3">
                        {isActive && (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Progress value={progressPct} className="flex-1" />
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {progressPct}%
                            </span>
                          </div>
                        )}
                        {isPublished && (
                          <span className="text-xs text-emerald-600 font-medium">已发布到平台</span>
                        )}
                        {isFailed && (
                          <span className="text-xs text-destructive font-medium truncate max-w-[200px]">
                            {p.errorMessage || "执行失败"}
                          </span>
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
        </>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
