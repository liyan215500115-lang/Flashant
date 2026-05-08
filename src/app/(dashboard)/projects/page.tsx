import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStageIndex, getTotalStages } from "@/lib/pipeline";

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

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const projects = await db.videoProject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-[960px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>项目列表</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            {projects.length === 0 ? "创建你的第一个视频项目" : `共 ${projects.length} 个项目`}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-md)" }}
        >
          ➕ 新建项目
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="mb-4" style={{ fontSize: 40 }}>🎬</div>
          <h3>还没有项目</h3>
          <p>粘贴商品链接，AI 自动生成短视频</p>
          <Link
            href="/projects/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-md)" }}
          >
            ➕ 创建第一个项目
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block p-4 rounded-lg border transition-colors hover:border-[var(--accent)]"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="truncate" style={{ fontSize: 16, fontWeight: 600 }}>
                      {p.productTitle || "未命名项目"}
                    </span>
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: p.status === "FAILED" ? "var(--error)" :
                          p.status === "PUBLISHED" ? "var(--success)" :
                          "var(--accent)",
                        color: "#fff",
                      }}
                    >
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }} className="truncate">
                    {p.productUrl}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  {p.status !== "FAILED" && p.status !== "PUBLISHED" && (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ width: 100, background: "var(--bg)", borderRadius: 4 }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${Math.round((getStageIndex(p.status) / (getTotalStages() - 1)) * 100)}%`,
                            background: "var(--accent)",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {getStageIndex(p.status) + 1}/{getTotalStages()}
                      </span>
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
