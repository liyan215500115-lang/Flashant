"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const SECONDARY_TABS = [
  { value: "main", label: "📦 主图筹备" },
  { value: "long", label: "📝 详情页长图" },
  { value: "listing", label: "✍️ Listing 文案" },
];

interface SecondaryTabsProps {
  value: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function SecondaryTabs({ value, onChange, className }: SecondaryTabsProps) {
  return (
    <Tabs value={value} onValueChange={onChange} className={cn("w-full", className)}>
      <TabsList className="w-full">
        {SECONDARY_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-1 text-xs">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
