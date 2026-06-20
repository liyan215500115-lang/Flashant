import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkGenerationQuota } from "@/lib/lemonsqueezy/billing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { PlanComparison } from "@/components/settings/plan-comparison";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import zh from "../../../../../messages/zh.json";
import en from "../../../../../messages/en.json";

const PLANS = [
  {
    tier: "FREE" as const,
    monthlyPrice: 0,
    annualPrice: 0,
    features: ["landing.pricing.plans.free.feature1", "landing.pricing.plans.free.feature2", "landing.pricing.plans.free.feature3", "landing.pricing.plans.free.feature4"],
  },
  {
    tier: "PRO" as const,
    monthlyPrice: 19,
    annualPrice: 190,
    features: ["landing.pricing.plans.pro.feature1", "landing.pricing.plans.pro.feature2", "landing.pricing.plans.pro.feature3", "landing.pricing.plans.pro.feature4", "landing.pricing.plans.pro.feature5"],
  },
  {
    tier: "BUSINESS" as const,
    monthlyPrice: 59,
    annualPrice: 590,
    features: ["landing.pricing.plans.business.feature1", "landing.pricing.plans.business.feature2", "landing.pricing.plans.business.feature3", "landing.pricing.plans.business.feature4", "landing.pricing.plans.business.feature5"],
  },
];

export default async function BillingPage() {
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

  const [subscription, quota] = await Promise.all([
    db.subscription.findUnique({ where: { userId } }),
    checkGenerationQuota(userId),
  ]);

  const currentTier = subscription?.planTier ?? "FREE";
  const isCancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;

  return (
    <div className="max-w-[720px] mx-auto">
      <Breadcrumb items={[
        { label: t("settings.title"), href: "/settings" },
        { label: t("billing.title") },
      ]} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300 tracking-tight">{t("billing.title")}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("billing.desc")}</p>
      </div>

      {/* Current Usage */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("billing.monthlyUsage")}</CardTitle>
          <CardDescription>
            {subscription?.currentPeriodStart
              ? `${t("billing.billingCycle")}: ${subscription.currentPeriodStart.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}`
              : t("landing.pricing.freePlan")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between mb-4">
            <div>
              <span className="text-3xl font-semibold tabular-nums">{quota.used}</span>
              <span className="text-muted-foreground ml-1">
                / {quota.limit === -1 ? "∞" : quota.limit}
              </span>
            </div>
            <Badge variant="default">
              {currentTier === "FREE" ? "Free" : currentTier === "PRO" ? "Pro" : "Business"}
            </Badge>
          </div>

          {/* Progress bar */}
          {quota.limit > 0 && (
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
                  background:
                    quota.used / quota.limit > 0.8
                      ? "var(--destructive)"
                      : "#2563EB",
                }}
              />
            </div>
          )}

          {quota.limit > 0 && quota.used >= quota.limit && (
            <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
              <Zap size={16} />
              {t("billing.quotaExhausted")}
            </div>
          )}

          {isCancelAtPeriodEnd && (
            <p className="text-xs text-muted-foreground mt-3">
              {t("billing.cancelAtPeriodEnd")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <h2 className="text-lg font-semibold mb-4">{t("billing.availablePlans")}</h2>
      <PlanComparison plans={PLANS} currentTier={currentTier} userId={userId} />
    </div>
  );
}
