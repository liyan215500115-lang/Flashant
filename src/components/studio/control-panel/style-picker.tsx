"use client";

import { Square, Image, User, Gem, Sun, Home, Coffee, Check } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface StyleDef {
  key: string;
  zh: string;
  en: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  prompt: string;
  promptZh: string;
}

const STYLES: StyleDef[] = [
  { key: "white", zh: "白底图", en: "White BG", icon: Square, prompt: "Product centered on pure white background, soft studio lighting, e-commerce packshot, 4K", promptZh: "产品居中纯白背景，柔和摄影棚灯光，电商白底图，4K" },
  { key: "scene", zh: "场景图", en: "Scene", icon: Image, prompt: "Product in a clean bright setting with natural lighting and premium texture, professional product photography", promptZh: "产品在干净明亮场景中，自然光线，高级质感，专业产品摄影" },
  { key: "model", zh: "模特图", en: "Model", icon: User, prompt: "Fashion model showcasing the product, natural pose, soft natural light, lifestyle setting, candid", promptZh: "时尚模特展示产品，自然姿态，柔和自然光，生活化场景" },
  { key: "marble", zh: "大理石", en: "Marble", icon: Gem, prompt: "Product on elegant white marble surface, soft window light, shallow depth of field, luxury aesthetic", promptZh: "产品在优雅白色大理石台面，柔和窗光，浅景深，奢华质感" },
  { key: "natural", zh: "自然光", en: "Natural", icon: Sun, prompt: "Product in natural outdoor setting, golden hour sunlight, blurred green foliage, lifestyle photography, warm tones", promptZh: "产品在自然户外场景，黄金时刻阳光，虚化绿色植物，生活摄影，温暖色调" },
  { key: "nordic", zh: "北欧风", en: "Nordic", icon: Home, prompt: "Product in bright Scandinavian interior, minimal decor, natural wood, soft diffused daylight, editorial", promptZh: "产品在明亮北欧风室内，极简装饰，天然木纹，柔和散射日光，杂志风格" },
  { key: "lifestyle", zh: "生活感", en: "Lifestyle", icon: Coffee, prompt: "Product in real use context, warm home or cafe, candid photography, relatable authentic, soft lighting", promptZh: "产品在真实使用场景，温馨居家或咖啡厅，抓拍风格，真实自然，柔和光线" },
];

interface StylePickerProps {
  value: string | null;
  onChange: (key: string, prompt: string) => void;
}

export function StylePicker({ value, onChange }: StylePickerProps) {
  const { t, locale } = useT();
  const isZh = locale === "zh";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("landing.nav.styles")}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {STYLES.map((s) => {
          const Icon = s.icon;
          const isActive = value === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(s.key, isZh ? s.promptZh : s.prompt)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500/20"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              <Icon size={18} className={isActive ? "text-brand-600" : ""} />
              <span className="text-[10px] font-medium leading-tight text-center">{isZh ? s.zh : s.en}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
