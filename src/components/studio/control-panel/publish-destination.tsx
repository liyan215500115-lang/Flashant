"use client";

import { Globe } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const IMAGE_PLATFORMS = [
  { value: "SHOPIFY", label: "Shopify" },
  { value: "AMAZON", label: "Amazon" },
  { value: "TIKTOK_SHOP", label: "TikTok Shop" },
  { value: "ETSY", label: "Etsy" },
  { value: "MERCADO_LIBRE", label: "Mercado Libre" },
];

interface PublishDestinationProps {
  value: string;
  onChange: (platform: string) => void;
  className?: string;
}

export function PublishDestination({ value, onChange, className }: PublishDestinationProps) {
  const selected = IMAGE_PLATFORMS.find((p) => p.value === value);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-zinc-700">发布目的地</span>
      <Select
        options={IMAGE_PLATFORMS.map((p) => ({
          value: p.value,
          label: p.label,
        }))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
      {selected && selected.value !== "" && (
        <p className="text-[11px] text-zinc-400 flex items-center gap-1">
          <Globe size={11} />
          图片生成后将按 {selected.value} 规格优化
        </p>
      )}
    </div>
  );
}
