import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { ConnectButton } from "@/components/integrations/connect-button";
import { HelpSection } from "@/components/integrations/help-section";
import { getTranslator } from "@/lib/locale.server";

function text(value: string, fallback: string) {
  return value || fallback;
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { t } = await getTranslator();
  const params = await searchParams;
  const userId = session.user.id;

  const shopify = await db.platformConnection.findUnique({
    where: { userId_platform: { userId, platform: "SHOPIFY" } },
  });
  const isConnected = !!(shopify?.isActive && shopify.platformStoreName);

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-8">
        <Link
          href="/settings"
          className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-200"
        >
          {text(t("settings.title"), "Settings")}
        </Link>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300 tracking-tight mt-2">
          {text(t("integrations.title"), "Integrations")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {text(
            t("integrations.desc"),
            "Connect your Shopify store. This is the only one-click publish path."
          )}
        </p>
      </div>

      {params.connected === "shopify" && isConnected && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          {text(
            t("integrations.connectedSuccess"),
            "Shopify is connected. You can publish from a project."
          )}
        </div>
      )}
      {params.error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {text(
            t("integrations.connectError"),
            "Shopify connection failed. Check the store domain and try again."
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted">
              <ShoppingCart size={20} className="text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Shopify</h3>
                {isConnected && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-[10px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    {text(t("integrations.connected"), "Connected")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {text(
                  t("integrations.shopifyOnly"),
                  "One-click publish. Other platforms are download-only."
                )}
              </p>
              {isConnected && shopify?.platformStoreName && (
                <p className="text-xs mt-1 text-brand-700 dark:text-brand-300 font-medium">
                  {shopify.platformStoreName}
                </p>
              )}
            </div>
          </div>
          <ConnectButton
            platform="SHOPIFY"
            platformName="Shopify"
            userId={userId}
            isConnected={isConnected}
            needsShopName
            connectedShopName={shopify?.platformStoreName ?? undefined}
          />
        </CardContent>
      </Card>

      <HelpSection />
    </div>
  );
}
