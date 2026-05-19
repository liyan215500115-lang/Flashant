import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Shield, Store } from "lucide-react";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";

const PLATFORM_INFO: Record<string, { name: string; status: "active" | "coming_soon" }> = {
  SHOPIFY: { name: "Shopify", status: "active" },
  TIKTOK_SHOP: { name: "TikTok Shop", status: "coming_soon" },
  ETSY: { name: "Etsy", status: "coming_soon" },
  MERCADO_LIBRE: { name: "Mercado Libre", status: "coming_soon" },
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const messages = locale === "zh" ? zh : en;
  const t = (key: string): string => {
    let val: unknown = messages;
    for (const k of key.split(".")) {
      if (val && typeof val === "object") val = (val as Record<string, unknown>)[k];
      else return "";
    }
    return typeof val === "string" ? val : "";
  };

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
        <h1 className="text-2xl font-bold text-brand-900 tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t("settings.desc")}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.accountInfo")}</CardTitle>
            <CardDescription>{t("settings.accountDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">{t("settings.email")}</span>
              <span className="text-sm font-medium">{session.user.email || "-"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">{t("settings.username")}</span>
              <span className="text-sm font-medium">{session.user.name || "-"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Platform Connections */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.platformConnections")}</CardTitle>
            <CardDescription>{t("settings.platformDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("settings.platformDesc")}
            </p>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900 transition-colors"
            >
              <Store size={14} />
              {t("settings.managePlatform")}
            </Link>
          </CardContent>
        </Card>

        {/* Brand Presets */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.brandPresets")}</CardTitle>
            <CardDescription>{t("settings.brandDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {brandPresets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Shield size={32} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("settings.noBrands")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("settings.noBrandsDesc")}
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
            <CardTitle>{t("settings.billing")}</CardTitle>
            <CardDescription>{t("settings.billingDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">{t("billing.currentTier")}</span>
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
              className="text-xs font-medium text-brand-700 hover:text-brand-900 transition-colors"
            >
              {t("settings.manageBilling")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
