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
  annual?: boolean;
}

export function BillingActions({ tier, isCurrent, annual }: BillingActionsProps) {
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
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTier: tier,
          interval: annual ? "annual" : "monthly",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || t("error.createFailed"));
      }

      if (data.url) {
        window.location.href = data.url;
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

export function ManageBillingButton() {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.message || t("billing.unavailable"));
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("billing.unavailable"));
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={openPortal} disabled={loading}>
        {loading ? t("billing.redirecting") : t("billing.manageSubscription")}
      </Button>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}
