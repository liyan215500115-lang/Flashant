import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ShoppingBag, Store, Globe, Truck, Package } from "lucide-react";
import { ConnectButton } from "@/components/integrations/connect-button";
import { HelpSection } from "@/components/integrations/help-section";
import { PLATFORM_LIST } from "@/lib/platform-specs";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";

function resolve(path: string, messages: Record<string, unknown>): string {
  const keys = path.split(".");
  let val: unknown = messages;
  for (const k of keys) {
    if (val && typeof val === "object" && k in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[k];
    } else { return path; }
  }
  return typeof val === "string" ? val : path;
}

function maybeT(path: string, fallback: string, messages: Record<string, unknown>): string {
  const result = resolve(path, messages);
  return result === path ? fallback : result;
}

const PLATFORM_ICONS: Record<string, typeof Store> = {
  SHOPIFY: ShoppingCart,
  AMAZON: Package,
  TIKTOK_SHOP: ShoppingBag,
  ETSY: Store,
  MERCADO_LIBRE: Globe,
  EBAY: ShoppingBag,
  WALMART: Truck,
  LAZADA: ShoppingBag,
  SHOPEE: ShoppingBag,
};

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const messages = locale === "zh" ? zh : en;
  const t = (key: string) => resolve(key, messages as unknown as Record<string, unknown>);
  const mt = (key: string, fallback: string) => maybeT(key, fallback, messages as unknown as Record<string, unknown>);

  const userId = session.user.id;
  const connections = await db.platformConnection.findMany({ where: { userId } });
  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300 tracking-tight">{t("integrations.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("integrations.desc")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {PLATFORM_LIST.map((spec) => {
          const conn = connections.find((c) => c.platform === spec.platform);
          const isConnected = connectedPlatforms.has(spec.platform as import("@prisma/client").Platform);
          const Icon = PLATFORM_ICONS[spec.platform] || Store;

          return (
            <Card key={spec.platform} className="hover:shadow-sm dark:hover:shadow-zinc-900/50 transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted">
                    <Icon size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{mt(`platforms.${spec.platform}.name`, spec.name)}</h3>
                      {spec.publishable && isConnected && (
                        <Badge variant="outline" className="gap-1.5 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                          {t("integrations.connected")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{mt(`platforms.${spec.platform}.background`, spec.background)}</p>
                    {isConnected && conn && (
                      <p className="text-xs mt-1 text-brand-700 dark:text-brand-300 font-medium">
                        {conn.platformStoreName || t("integrations.connected")}
                      </p>
                    )}
                  </div>
                </div>

                {spec.publishable && (
                  <ConnectButton
                    platform={spec.platform}
                    platformName={spec.name}
                    userId={userId}
                    isConnected={isConnected}
                    needsShopName={spec.platform === "SHOPIFY"}
                    connectedShopName={conn?.platformStoreName ?? undefined}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <HelpSection />
    </div>
  );
}
