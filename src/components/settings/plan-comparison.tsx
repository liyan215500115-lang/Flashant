"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { BillingActions } from "@/app/(dashboard)/settings/billing/BillingActions";
import { useT } from "@/components/i18n-provider";

interface Plan {
  tier: "FREE" | "PRO" | "BUSINESS";
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
}

interface PlanComparisonProps {
  plans: Plan[];
  currentTier: string;
  userId: string;
}

export function PlanComparison({ plans, currentTier, userId }: PlanComparisonProps) {
  const { t } = useT();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span
          className={`text-sm cursor-pointer transition-colors ${
            billingPeriod === "monthly" ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"
          }`}
          onClick={() => setBillingPeriod("monthly")}
        >
          {t("billing.monthly")}
        </span>
        <button
          type="button"
          onClick={() => setBillingPeriod((p) => (p === "monthly" ? "annual" : "monthly"))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            billingPeriod === "annual" ? "bg-brand-900" : "bg-zinc-200 dark:bg-zinc-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              billingPeriod === "annual" ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm cursor-pointer transition-colors ${
            billingPeriod === "annual" ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"
          }`}
          onClick={() => setBillingPeriod("annual")}
        >
          {t("billing.annual")}
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[10px] font-semibold text-green-700 dark:text-green-400">
            {t("billing.savePercent")}
          </span>
        </span>
      </div>

      {/* Plan grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          const price = billingPeriod === "annual" ? plan.annualPrice : plan.monthlyPrice;

          return (
            <Card
              key={plan.tier}
              style={{
                borderColor: isCurrent ? "#2563EB" : "var(--border)",
              }}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold dark:text-zinc-100">
                    {t(`landing.pricing.plans.${plan.tier.toLowerCase()}.name`)}
                  </h3>
                  {isCurrent && (
                    <Badge
                      variant="default"
                      className="text-xs"
                      style={{ background: "#2563EB" }}
                    >
                      {t("billing.current")}
                    </Badge>
                  )}
                </div>

                <div className="mb-4">
                  <span className="text-2xl font-bold dark:text-zinc-100">
                    {plan.tier === "FREE" ? "$0" : `$${price}`}
                    {plan.tier !== "FREE" && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{billingPeriod === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </span>
                  {plan.tier !== "FREE" && billingPeriod === "annual" && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      ${plan.monthlyPrice * 12 - plan.annualPrice} {t("billing.saved")}
                    </p>
                  )}
                </div>

                <ul className="flex flex-col gap-2 mb-5">
                  {plan.features.map((fKey) => (
                    <li key={fKey} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check size={14} className="text-holo-500 dark:text-holo-400 flex-shrink-0" />
                      {t(fKey)}
                    </li>
                  ))}
                </ul>

                <BillingActions
                  tier={plan.tier}
                  isCurrent={isCurrent}
                  userId={userId}
                  annual={billingPeriod === "annual"}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
