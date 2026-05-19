"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface BillingActionsProps {
  tier: string;
  isCurrent: boolean;
  userId: string;
}

const STRIPE_PRICE_IDS: Record<string, string> = {
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? "",
};

export function BillingActions({ tier, isCurrent, userId }: BillingActionsProps) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (tier === "FREE" && isCurrent) {
    return (
      <Button variant="outline" size="sm" disabled className="w-full">
        {t("billing.current")}
      </Button>
    );
  }

  if (isCurrent) {
    return (
      <Button variant="outline" size="sm" disabled className="w-full">
        {t("billing.current")}
      </Button>
    );
  }

  if (tier === "FREE") {
    return (
      <Button variant="outline" size="sm" className="w-full" disabled>
        {t("billing.contactDowngrade")}
      </Button>
    );
  }

  async function handleUpgrade() {
    setLoading(true);
    setError("");

    try {
      const priceId = STRIPE_PRICE_IDS[tier];
      if (!priceId) {
        setError(t("billing.unavailable"));
        setLoading(false);
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          planTier: tier,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("error.createFailed"));
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        setError(t("billing.unavailable"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.createFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        variant="default"
        size="sm"
        className="w-full gap-2"
        onClick={handleUpgrade}
        disabled={loading}
      >
        <Zap size={14} />
        {loading ? t("billing.redirecting") : tier === "PRO" ? t("billing.upgradeToPro") : t("billing.upgradeToBusiness")}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
