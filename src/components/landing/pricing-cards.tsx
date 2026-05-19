"use client";

import Link from "next/link";
import { Check } from "lucide-react";

interface PlanDef {
  tier: "FREE" | "PRO" | "BUSINESS";
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  highlighted: boolean;
}

interface PricingCardsProps {
  currentPlan?: string;
  userLoggedIn?: boolean;
  popularLabel: string;
  currentPlanLabel: string;
  getStartedLabel: string;
  learnMoreLabel: string;
  goToWorkspaceLabel: string;
  plans: PlanDef[];
}

export function PricingCards({
  currentPlan,
  userLoggedIn,
  popularLabel,
  currentPlanLabel,
  getStartedLabel,
  learnMoreLabel,
  goToWorkspaceLabel,
  plans,
}: PricingCardsProps) {
  const isCurrentPlan = (tier: string) =>
    currentPlan?.toUpperCase() === tier.toUpperCase();

  const linkHref = userLoggedIn ? "/products/new" : "/login";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {plans.map((plan) => {
        const isCurrent = isCurrentPlan(plan.tier);

        return (
          <div
            key={plan.tier}
            className={`relative rounded-2xl border bg-white p-6 md:p-8 flex flex-col transition-all duration-300 hover:shadow-md ${
              plan.highlighted
                ? "border-blue-600 ring-2 ring-blue-600"
                : "border-zinc-100"
            }`}
          >
            {plan.highlighted && !isCurrent && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-blue-600 text-white text-xs font-medium px-3 py-0.5">
                {popularLabel}
              </span>
            )}
            {isCurrent && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-zinc-900 text-white text-xs font-medium px-3 py-0.5">
                {currentPlanLabel}
              </span>
            )}

            <div className="mb-6">
              <h3 className="text-base font-semibold text-zinc-900">
                {plan.name}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">{plan.desc}</p>
            </div>

            <div className="mb-6">
              <span className="text-3xl font-bold text-zinc-900">
                {plan.price}
              </span>
              <span className="text-sm text-zinc-400">{plan.period}</span>
            </div>

            <ul className="space-y-2.5 mb-8 flex-1">
              {plan.features.map((feat) => (
                <li
                  key={feat}
                  className="flex items-start gap-2 text-sm text-zinc-600"
                >
                  <Check
                    size={14}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />
                  {feat}
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center w-full rounded-xl px-4 py-2.5 text-sm font-medium bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
              >
                {goToWorkspaceLabel}
              </Link>
            ) : (
              <Link
                href={linkHref}
                className={`inline-flex items-center justify-center w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                  plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                }`}
              >
                {plan.highlighted ? getStartedLabel : learnMoreLabel}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
