import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Store, ExternalLink } from "lucide-react";

const PLATFORM_INFO: Record<string, { name: string; status: "active" | "coming_soon"; desc: string }> = {
  SHOPIFY: { name: "Shopify", status: "active", desc: "全球最大的独立站电商平台" },
  AMAZON: { name: "Amazon", status: "coming_soon", desc: "全球最大电商平台，支持 SP API" },
  TIKTOK_SHOP: { name: "TikTok Shop", status: "coming_soon", desc: "短视频电商，内容驱动成交" },
  ETSY: { name: "Etsy", status: "coming_soon", desc: "手工艺品与创意商品平台" },
  MERCADO_LIBRE: { name: "Mercado Libre", status: "coming_soon", desc: "拉丁美洲最大电商平台" },
};

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const connections = await db.platformConnection.findMany({ where: { userId } });
  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">渠道连接器</h1>
        <p className="text-sm text-muted-foreground mt-1">绑定电商平台，一键发布到全球渠道</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Object.entries(PLATFORM_INFO).map(([key, info]) => {
          const platformKey = key as import("@prisma/client").Platform;
          const conn = connections.find((c) => c.platform === platformKey);
          const isConnected = connectedPlatforms.has(platformKey);

          return (
            <Card key={key}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ background: "var(--bg)" }}
                  >
                    <Store size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{info.name}</h3>
                      {info.status === "coming_soon" ? (
                        <Badge variant="secondary" className="text-[10px]">即将上线</Badge>
                      ) : isConnected ? (
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.desc}</p>
                    {isConnected && conn && (
                      <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>
                        {conn.platformStoreName || "已连接"}
                      </p>
                    )}
                  </div>
                </div>

                {info.status === "active" && (
                  isConnected ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">已授权</Badge>
                      <Link
                        href={`/api/auth/shopify?userId=${userId}`}
                        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                      >
                        重新连接 <ExternalLink size={10} />
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/api/auth/shopify?userId=${userId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                      style={{ background: "var(--accent)" }}
                    >
                      连接 Shopify
                    </Link>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
