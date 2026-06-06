"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";

interface ConnectButtonProps {
  platform: string;
  platformName: string;
  userId: string;
  isConnected: boolean;
  needsShopName?: boolean;
  connectedShopName?: string;
}

export function ConnectButton({
  platform,
  platformName,
  userId,
  isConnected,
  needsShopName,
  connectedShopName,
}: ConnectButtonProps) {
  const { t } = useT();
  const [showInput, setShowInput] = useState(false);
  const [shopName, setShopName] = useState("");

  const authPath =
    platform === "TIKTOK_SHOP" ? "tiktok" : "shopify";

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {t("integrations.authorized")}
        </Badge>
        <Link
          href={
            needsShopName && connectedShopName
              ? `/api/auth/${authPath}?userId=${userId}&shop=${encodeURIComponent(connectedShopName)}`
              : `/api/auth/${authPath}?userId=${userId}`
          }
          className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
        >
          {t("integrations.reconnect")} <ExternalLink size={10} />
        </Link>
      </div>
    );
  }

  if (needsShopName && !showInput) {
    return (
      <Button
        size="sm"
        className="text-xs gap-1.5"
        onClick={() => setShowInput(true)}
      >
        {t("integrations.connectPlatform").replace("{name}", platformName)}
      </Button>
    );
  }

  if (needsShopName && showInput) {
    return (
      <div className="flex items-center gap-2">
        <Input
          placeholder="your-store.myshopify.com"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="h-8 text-xs w-52"
        />
        <a
          href={
            shopName.includes(".")
              ? `/api/auth/${authPath}?shop=${encodeURIComponent(shopName)}&userId=${userId}`
              : undefined
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
          style={{
            background: shopName.includes(".") ? "#2563EB" : "var(--border)",
            pointerEvents: shopName.includes(".") ? "auto" : "none",
          }}
        >
          {t("integrations.confirm")}
        </a>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => setShowInput(false)}
        >
          {t("common.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <Link
      href={`/api/auth/${authPath}?userId=${userId}`}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
      style={{ background: "#2563EB" }}
    >
      {t("integrations.connectPlatform").replace("{name}", platformName)}
    </Link>
  );
}
