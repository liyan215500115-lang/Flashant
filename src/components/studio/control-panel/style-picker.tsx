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
  { key: "white", zh: "纯白底", en: "White BG", icon: Square, prompt: "Product centered on pure white background, soft even studio lighting, subtle natural shadow beneath, commercial e-commerce packshot, 4K, sharp details", promptZh: "产品居中纯白背景，均匀柔和摄影棚灯光，自然淡影，商业电商白底图，4K，细节清晰" },
  { key: "scene", zh: "场景图", en: "Scene", icon: Image, prompt: "Product styled in a clean, aspirational setting appropriate to its use. For furniture/appliances: in a bright modern room. For electronics: on a clean desk with natural light. For fashion/beauty: on a vanity or dresser. Professional interior photography, natural lighting, 4K", promptZh: "产品置于干净高级的使用场景中。家具/电器：明亮现代房间。电子：整洁桌面自然光。时尚/美妆：梳妆台或衣帽间。专业室内摄影，自然光线，4K" },
  { key: "in_use", zh: "使用中", en: "In Use", icon: User, prompt: "The product being actively used by a person. For wearables/earbuds: worn by a model showing fit. For kitchenware: hands cooking. For tools: hands working. For skincare: applying on face. Natural interaction, candid moment, soft daylight, authentic lifestyle photography, 4K", promptZh: "产品正在被人使用。穿戴设备/耳机：模特佩戴展示贴合感。厨具：手在烹饪。工具：手在操作。护肤品：涂抹在脸上。自然互动，抓拍瞬间，柔和日光，真实生活摄影，4K" },
  { key: "marble", zh: "奢华风", en: "Luxury", icon: Gem, prompt: "Product styled on elegant marble or dark wood surface with soft directional light creating depth. Gold or metallic accents in the composition. Premium luxury aesthetic. For jewelry/watches: macro details on velvet. For beauty: glass bottles with golden caps. High-end commercial photography, 4K", promptZh: "产品置于优雅大理石或深色木纹台面，柔和定向光营造层次感。构图含金色或金属点缀。珠宝手表：天鹅绒上微距细节。美妆：玻璃瓶金盖。高端商业摄影，4K" },
  { key: "natural", zh: "户外自然", en: "Outdoor", icon: Sun, prompt: "Product in a natural outdoor setting. Golden hour sunlight casts warm glow. For outdoor gear: trail or campsite context. For fashion: city street or park. For food/beverage: picnic table or garden. Blurred natural greenery or sky background. Lifestyle photography, warm tones, 4K", promptZh: "产品在自然户外环境。黄金时段阳光暖色调。户外装备：山路或营地。时尚：城市街道或公园。食品饮料：野餐桌或花园。虚化自然绿植或天空背景。生活方式摄影，温暖色调，4K" },
  { key: "cosy", zh: "温馨家", en: "Cosy Home", icon: Home, prompt: "Product in a warm, inviting home interior. Soft warm lighting, textiles and natural materials. For furniture: styled room corner. For home goods: on a wooden table. For food: kitchen counter with fresh ingredients. For candles/diffusers: cozy evening ambiance. Scandinavian or Japandi style, 4K", promptZh: "产品在温暖宜人的家居环境中。柔和暖光，纺织品与天然材质。家具：布置好的房间角落。家居用品：木桌上。食品：厨房台面配新鲜食材。香薰蜡烛：温馨夜晚氛围。北欧或侘寂风格，4K" },
  { key: "dark_moody", zh: "暗调高级", en: "Dark & Moody", icon: Coffee, prompt: "Product dramatically lit against a dark background. Single key light creates striking shadows and highlights. For electronics: glowing screen in dark room. For spirits/wine: bottle with rim light. For luxury items: spotlight on black velvet. Cinematic product photography, intense contrast, premium feel, 4K", promptZh: "产品在深色背景中戏剧性打光。单主光源营造强烈阴影与高光。电子产品：暗室中屏幕发光。酒类：瓶身轮廓光。奢侈品：黑丝绒聚光灯。电影感产品摄影，强对比，高级感，4K" },
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
