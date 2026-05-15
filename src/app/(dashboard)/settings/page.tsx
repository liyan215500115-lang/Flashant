import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Shield, Store } from "lucide-react";

const PLATFORM_INFO: Record<string, { name: string; status: "active" | "coming_soon" }> = {
  SHOPIFY: { name: "Shopify", status: "active" },
  TIKTOK_SHOP: { name: "TikTok Shop", status: "coming_soon" },
  ETSY: { name: "Etsy", status: "coming_soon" },
  MERCADO_LIBRE: { name: "Mercado Libre", status: "coming_soon" },
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const [connections, subscription, brandPresets] = await Promise.all([
    db.platformConnection.findMany({ where: { userId } }),
    db.subscription.findUnique({ where: { userId } }),
    db.brandPreset.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="text-sm text-muted-foreground mt-1">账号信息、平台连接和品牌预设</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>账号信息</CardTitle>
            <CardDescription>当前登录账号的基本信息</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">邮箱</span>
              <span className="text-sm font-medium">{session.user.email || "-"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">用户名</span>
              <span className="text-sm font-medium">{session.user.name || "-"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Platform Connections */}
        <Card>
          <CardHeader>
            <CardTitle>平台连接</CardTitle>
            <CardDescription>绑定电商平台以发布商品图</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {Object.entries(PLATFORM_INFO).map(([key, info]) => {
                const platformKey = key as import("@prisma/client").Platform;
                const conn = connections.find((c) => c.platform === platformKey);
                const isConnected = connectedPlatforms.has(platformKey);

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Store size={16} className="text-muted-foreground" />
                      <span className="text-sm">{info.name}</span>
                    </div>

                    {info.status === "coming_soon" ? (
                      <Badge variant="secondary" className="text-xs">即将上线</Badge>
                    ) : isConnected && conn ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {conn.platformStoreName || "已连接"}
                        </span>
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                    ) : (
                      <Link
                        href={`/api/auth/shopify?userId=${userId}`}
                        className="text-xs font-medium hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        连接 Shopify
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Brand Presets */}
        <Card>
          <CardHeader>
            <CardTitle>品牌预设</CardTitle>
            <CardDescription>保存品牌信息，生成时自动填充</CardDescription>
          </CardHeader>
          <CardContent>
            {brandPresets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Shield size={32} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">暂无品牌预设</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    添加品牌 Logo 和配色，生成时自动应用
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {brandPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {preset.logoUrl ? (
                        <img
                          src={preset.logoUrl}
                          alt={preset.name}
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-xs font-medium"
                          style={{ background: "var(--bg)" }}
                        >
                          {preset.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium">{preset.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {((preset.colors as string[]) || []).slice(0, 3).map((color: string) => (
                        <span
                          key={color}
                          className="inline-flex w-3 h-3 rounded-full border border-border"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <CardTitle>套餐与用量</CardTitle>
            <CardDescription>当前套餐和本月使用情况</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">当前套餐</span>
              <Badge variant="default">
                {subscription?.planTier === "PRO"
                  ? "Pro"
                  : subscription?.planTier === "BUSINESS"
                    ? "Business"
                    : "Free"}
              </Badge>
            </div>
            <Link
              href="/settings/billing"
              className="text-xs font-medium hover:underline"
              style={{ color: "var(--accent)" }}
            >
              管理套餐 →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
