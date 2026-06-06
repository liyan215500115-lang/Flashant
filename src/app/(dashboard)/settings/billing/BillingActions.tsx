"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { toast } from "sonner";

interface BillingActionsProps {
  tier: string;
  isCurrent: boolean;
  userId: string;
  annual?: boolean;
}

const VARIANT_IDS: Record<string, string> = {
  PRO: process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_VARIANT_ID ?? "",
  BUSINESS: process.env.NEXT_PUBLIC_LEMONSQUEEZY_BUSINESS_VARIANT_ID ?? "",
};

export function BillingActions({ tier, isCurrent, userId, annual }: BillingActionsProps) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isCurrent) {
    return (
      <Badge variant="default" className="w-full justify-center py-1.5 text-sm font-medium">
        {t("billing.current")}
      </Badge>
    );
  }

  if (tier === "FREE") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => toast.info(t("billing.contactDowngrade"))}
      >
        {t("billing.contactDowngrade")}
      </Button>
    );
  }

  async function handleUpgrade() {
    setLoading(true);
    setError("");

    try {
      const variantId = VARIANT_IDS[tier];
      if (!variantId) {
        setError(t("billing.unavailable"));
        setLoading(false);
        return;
      }

      const res = await fetch("/api/lemonsqueezy/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
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
