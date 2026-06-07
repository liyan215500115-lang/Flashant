"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Sparkles, Rocket, ArrowRight, X, Check } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { t } = useT();
  const [step, setStep] = useState(0);

  if (!open) return null;

  const steps = [
    {
      icon: Upload,
      title: t("onboarding.step1Title"),
      desc: t("onboarding.step1Desc"),
      highlight: t("onboarding.step1Tip"),
    },
    {
      icon: Sparkles,
      title: t("onboarding.step2Title"),
      desc: t("onboarding.step2Desc"),
      highlight: t("onboarding.step2Tip"),
    },
    {
      icon: Rocket,
      title: t("onboarding.step3Title"),
      desc: t("onboarding.step3Desc"),
      highlight: t("onboarding.step3Tip"),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-[90vw] overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{t("onboarding.welcome")}</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              {t("onboarding.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pb-1 flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-brand-900" : "bg-zinc-200"}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-900"
            >
              <current.icon size={22} color="#fff" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                {current.title}
              </h3>
              <p className="text-xs text-zinc-500">
                {t("onboarding.stepTitle").replace("{current}", String(step + 1)).replace("{total}", String(steps.length))}
              </p>
            </div>
          </div>

          <p className="text-sm text-zinc-600 mb-3">{current.desc}</p>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <Check size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">{current.highlight}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            {t("onboarding.skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
              >
                {t("onboarding.prev")}
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 bg-brand-900 hover:bg-brand-800 text-white"
              onClick={() => {
                if (isLast) onClose();
                else setStep(step + 1);
              }}
            >
              {isLast ? t("onboarding.start") : t("onboarding.next")}
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
