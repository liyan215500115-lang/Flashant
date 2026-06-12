"use client";

import { useState } from "react";
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
  popularLabel,
  currentPlanLabel,
  getStartedLabel,
  learnMoreLabel,
  goToWorkspaceLabel,
  plans,
}: PricingCardsProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const activeTier = selectedTier ?? currentPlan;

  const isActive = (tier: string) =>
    activeTier?.toUpperCase() === tier.toUpperCase();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {plans.map((plan) => {
        const active = isActive(plan.tier);
        const isReallyCurrent = currentPlan?.toUpperCase() === plan.tier.toUpperCase();

        return (
          <button
            type="button"
            key={plan.tier}
            onClick={() => setSelectedTier(plan.tier)}
            className={`relative rounded-2xl border bg-white p-6 md:p-8 flex flex-col transition-all duration-200 text-left ${
              active
                ? "border-brand-600 ring-2 ring-brand-600/20 shadow-md"
                : "border-zinc-200 hover:border-brand-300 hover:shadow-md cursor-pointer"
            }`}
          >
            {plan.highlighted && !active && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-brand-900 text-white text-xs font-medium px-3 py-0.5">
                {popularLabel}
              </span>
            )}
            {isReallyCurrent && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-zinc-800 text-white text-xs font-medium px-3 py-0.5">
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
              <span className="text-3xl font-bold text-zinc-900 tabular-nums">
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
                  <Check size={14} className="mt-0.5 shrink-0 text-brand-600" />
                  {feat}
                </li>
              ))}
            </ul>

            <div className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium text-center transition-colors ${
              active
                ? "bg-brand-900 text-white"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}>
              {isReallyCurrent && active
                ? goToWorkspaceLabel
                : active && !isReallyCurrent
                  ? getStartedLabel
                  : plan.highlighted
                    ? getStartedLabel
                    : learnMoreLabel}
            </div>
          </button>
        );
      })}
    </div>
  );
}
