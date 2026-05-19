import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image, Download } from "lucide-react";

export default async function AssetsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const images = await db.generatedImage.findMany({
    where: {
      project: { userId },
      status: "SUCCEEDED",
    },
    include: {
      project: { select: { title: true, targetPlatform: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 48,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">素材中心</h1>
          <p className="text-sm text-muted-foreground mt-1">
            所有已生成商品图 · 共 {images.length} 张
          </p>
        </div>
      </div>

      {images.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <Image size={40} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">暂无素材</h3>
            <p className="text-sm text-muted-foreground">
              前往智能车间生成第一张商品图
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-100 border border-zinc-100"
              >
                <img
                  src={img.url}
                  alt={img.promptUsed ?? "生成图"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="text-[10px] text-white/80 truncate max-w-[60%]">
                      {img.project.title || "未命名"}
                    </span>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-white transition-colors"
                    >
                      <Download size={10} />
                      下载
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
