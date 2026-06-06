"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface SecondaryTabsProps {
  value: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function SecondaryTabs({ value, onChange, className }: SecondaryTabsProps) {
  const { t } = useT();

  const tabs = [
    { value: "main", label: t("generate.tabMain") },
    { value: "long", label: t("generate.tabLong") },
    { value: "listing", label: t("generate.tabListing") },
  ];

  return (
    <Tabs value={value} onValueChange={onChange} className={cn("w-full", className)}>
      <TabsList className="w-full">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-1 text-xs">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
