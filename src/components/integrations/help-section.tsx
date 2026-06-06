"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, ChevronDown, ExternalLink } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface HelpLink {
  label: string;
  description: string;
  url: string;
}

export function HelpSection() {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const platformHelp: Record<string, { name: string; links: HelpLink[] }> = {
    SHOPIFY: {
      name: "Shopify",
      links: [
        {
          label: t("integrations.helpNoShopify"),
          description: t("integrations.helpNoShopifyDesc"),
          url: "https://www.shopify.com/zh/start",
        },
        {
          label: t("integrations.helpFindDomain"),
          description: t("integrations.helpFindDomainDesc"),
          url: "https://help.shopify.com/zh-CN/manual/domains",
        },
      ],
    },
    TIKTOK_SHOP: {
      name: "TikTok Shop",
      links: [
        {
          label: t("integrations.helpNoTiktok"),
          description: t("integrations.helpNoTiktokDesc"),
          url: "https://seller.tiktokglobalshop.com",
        },
        {
          label: t("integrations.helpTiktokGuide"),
          description: t("integrations.helpTiktokGuideDesc"),
          url: "https://seller.tiktokglobalshop.com/guide",
        },
      ],
    },
  };

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <HelpCircle size={16} />
        <span>{t("integrations.helpTitle")}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          {Object.entries(platformHelp).map(([key, info]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3">{info.name}</h4>
                <div className="flex flex-col gap-2">
                  {info.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted transition-colors group"
                    >
                      <ExternalLink
                        size={14}
                        className="mt-0.5 text-muted-foreground group-hover:text-foreground shrink-0"
                      />
                      <div>
                        <span className="text-sm font-medium group-hover:underline">
                          {link.label}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {link.description}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
