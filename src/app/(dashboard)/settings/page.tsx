import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Store, User, Plug, Palette, CreditCard } from "lucide-react";
import { BrandPresetsCard } from "@/components/settings/brand-presets-card";
import { ProfileEditCard } from "@/components/settings/profile-edit-card";
import { Suspense } from "react";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";

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

  const [connections, subscription] = await Promise.all([
    db.platformConnection.findMany({ where: { userId } }),
    db.subscription.findUnique({ where: { userId } }),
  ]);

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300 tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t("settings.desc")}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Account Info with editing */}
        <ProfileEditCard
          email={session.user.email ?? ""}
          currentName={session.user.name ?? ""}
          currentImage={session.user.image ?? null}
          labels={{
            accountInfo: t("settings.accountInfo"),
            accountDesc: t("settings.accountDesc"),
            email: t("settings.email"),
            username: t("settings.username"),
            currentPassword: t("settings.currentPassword"),
            newPassword: t("settings.newPassword"),
            changeName: t("settings.changeName"),
            changePassword: t("settings.changePassword"),
            saving: t("common.save"),
            saved: t("settings.saved"),
            namePlaceholder: t("auth.namePlaceholder"),
            nameRequired: t("settings.nameRequired"),
            passwordRequired: t("settings.passwordRequired"),
            passwordMinLength: t("auth.errorWeakPassword"),
            wrongPassword: t("settings.wrongPassword"),
            updateError: t("settings.updateError"),
          }}
        />

        {/* Platform Connections */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-holo-50 dark:bg-holo-900/20">
                <Plug size={18} className="text-holo-600 dark:text-holo-400" />
              </div>
              <div>
                <CardTitle>{t("settings.platformConnections")}</CardTitle>
                <CardDescription>{t("settings.platformDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("settings.platformDesc")}
            </p>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-200 transition-colors"
            >
              <Store size={14} />
              {t("settings.managePlatform")}
            </Link>
          </CardContent>
        </Card>

        {/* Brand Presets */}
        <Suspense fallback={null}>
          <BrandPresetsCard
            userId={userId}
            labels={{
              title: t("settings.brandPresets"),
              desc: t("settings.brandDesc"),
              noBrands: t("settings.noBrands"),
              noBrandsDesc: t("settings.noBrandsDesc"),
              createBtn: t("settings.createBrand"),
              editBtn: t("settings.editBrand"),
              deleteBtn: t("settings.deleteBrand"),
              formTitle: t("settings.brandFormTitle"),
              formDesc: t("settings.brandFormDesc"),
              formEditTitle: t("settings.brandFormEditTitle"),
              formEditDesc: t("settings.brandFormEditDesc"),
              namePlaceholder: t("settings.brandNamePlaceholder"),
              logoLabel: t("settings.brandLogoLabel"),
              colorsLabel: t("settings.brandColorsLabel"),
              saveBtn: t("settings.brandSaveBtn"),
              saving: t("settings.brandSaving"),
            }}
          />
        </Suspense>

        {/* Billing */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold-50 dark:bg-gold-900/20">
                <CreditCard size={18} className="text-gold-600 dark:text-gold-400" />
              </div>
              <div>
                <CardTitle>{t("settings.billing")}</CardTitle>
                <CardDescription>{t("settings.billingDesc")}</CardDescription>
              </div>
            </div>
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
              className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-200 transition-colors"
            >
              {t("settings.manageBilling")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
