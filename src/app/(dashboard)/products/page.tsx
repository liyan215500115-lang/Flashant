import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Image, AlertCircle, CheckCircle2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  GENERATING: "生成中",
  GENERATED: "已生成",
  REVIEW: "待审核",
  APPROVED: "已审核",
  PUBLISHING: "发布中",
  PUBLISHED: "已发布",
  FAILED: "失败",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  if (status === "FAILED")
    return <Badge variant="destructive">{label}</Badge>;
  if (status === "PUBLISHED")
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">
        {label}
      </Badge>
    );
  if (status === "GENERATING")
    return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="default">{label}</Badge>;
}

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const projects = await db.imageProject.findMany({
    where: { userId: session.user.id },
    include: {
      productImages: { take: 1, orderBy: { sortOrder: "asc" } },
      generatedImages: {
        where: { status: "SUCCEEDED" },
        take: 1,
      },
      promptTemplate: { select: { name: true, nameZh: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">商品图</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length > 0
              ? `${projects.length} 个项目`
              : "创建你的第一个商品图项目"}
          </p>
        </div>
        <Link href="/products/new">
          <Button variant="default">
            <Plus className="w-4 h-4 mr-1.5" />
            新建项目
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="card-static">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Image className="w-12 h-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                还没有项目
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                上传产品图，AI 自动生成多场景商品图，一键发布到 Shopify
              </p>
            </div>
            <Link href="/products/new">
              <Button variant="default">
                <Plus className="w-4 h-4 mr-1.5" />
                创建第一个项目
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/products/${project.id}`}>
              <Card className="card-hover h-full cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-medium truncate"
                        style={{ fontSize: 15, color: "var(--text-primary)" }}
                      >
                        {project.title || "未命名项目"}
                      </h3>
                      {project.promptTemplate && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {project.promptTemplate.nameZh || project.promptTemplate.name}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  <div
                    className="aspect-square rounded-lg mb-3 flex items-center justify-center overflow-hidden"
                    style={{ background: "var(--bg)" }}
                  >
                    {project.productImages[0] ? (
                      <img
                        src={project.productImages[0].originalUrl}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : project.generatedImages[0] ? (
                      <img
                        src={project.generatedImages[0].url}
                        alt="Generated"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image className="w-10 h-10" style={{ color: "var(--text-secondary)" }} />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>{project.productImages.length} 张产品图</span>
                    <span>·</span>
                    <span>{project.generatedImages.length} 个生成结果</span>
                    {project.status === "FAILED" && project.errorMessage && (
                      <AlertCircle className="w-3.5 h-3.5 ml-auto text-destructive" />
                    )}
                    {project.status === "PUBLISHED" && (
                      <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
