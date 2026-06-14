"use client";

import { useState, useRef } from "react";
import { Square, Image, User, Gem, Sun, Home, Coffee } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface StyleDef {
  key: string; zh: string; en: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  prompt: string; promptZh: string;
}

const STYLES: StyleDef[] = [
  { key: "white", zh: "纯白底", en: "White BG", icon: Square, prompt: "Product centered on pure white background, soft even studio lighting, subtle natural shadow beneath, commercial e-commerce packshot, 4K, sharp details", promptZh: "产品居中纯白背景，均匀柔和摄影棚灯光，自然淡影，商业电商白底图，4K，细节清晰" },
  { key: "scene", zh: "场景图", en: "Scene", icon: Image, prompt: "Product styled in a clean, aspirational setting appropriate to its use. For furniture/appliances: in a bright modern room. For electronics: on a clean desk with natural light. Professional interior photography, natural lighting, 4K", promptZh: "产品置于干净高级的使用场景中。家具/电器：明亮现代房间。电子：整洁桌面自然光。专业室内摄影，自然光线，4K" },
  { key: "in_use", zh: "使用中", en: "In Use", icon: User, prompt: "The product being actively used by a person. For wearables/earbuds: worn by a model showing fit. For kitchenware: hands cooking. Natural interaction, candid moment, soft daylight, authentic lifestyle photography, 4K", promptZh: "产品正在被人使用。穿戴设备/耳机：模特佩戴展示贴合感。厨具：手在烹饪。自然互动，抓拍瞬间，柔和日光，真实生活摄影，4K" },
  { key: "marble", zh: "奢华风", en: "Luxury", icon: Gem, prompt: "Product styled on elegant marble or dark wood surface with soft directional light creating depth. Gold or metallic accents in the composition. Premium luxury aesthetic. High-end commercial photography, 4K", promptZh: "产品置于优雅大理石或深色木纹台面，柔和定向光营造层次感。构图含金色或金属点缀。高端商业摄影，4K" },
  { key: "natural", zh: "户外自然", en: "Outdoor", icon: Sun, prompt: "Product in a natural outdoor setting. Golden hour sunlight casts warm glow. Blurred natural greenery or sky background. Lifestyle photography, warm tones, 4K", promptZh: "产品在自然户外环境。黄金时段阳光暖色调。虚化自然绿植或天空背景。生活方式摄影，温暖色调，4K" },
  { key: "cosy", zh: "温馨家", en: "Cosy Home", icon: Home, prompt: "Product in a warm, inviting home interior. Soft warm lighting, textiles and natural materials. Scandinavian or Japandi style, 4K", promptZh: "产品在温暖宜人的家居环境中。柔和暖光，纺织品与天然材质。北欧或侘寂风格，4K" },
  { key: "dark_moody", zh: "暗调高级", en: "Dark & Moody", icon: Coffee, prompt: "Product dramatically lit against a dark background. Single key light creates striking shadows and highlights. Cinematic product photography, intense contrast, premium feel, 4K", promptZh: "产品在深色背景中戏剧性打光。单主光源营造强烈阴影与高光。电影感产品摄影，强对比，高级感，4K" },
  { key: "cyberpunk", zh: "赛博朋克", en: "Cyberpunk", icon: Coffee, prompt: "Product in a cyberpunk aesthetic — neon cyan and magenta rim lighting, dark moody background with subtle grid lines, reflective wet surfaces, Blade Runner 2049 atmosphere, cinematic, ultra-detailed, 4K", promptZh: "赛博朋克风格产品摄影——霓虹青紫边缘光，深色背景带网格线条，反光湿润表面，银翼杀手2049氛围，电影感，超精细，4K" },
  { key: "magazine", zh: "杂志质感", en: "Magazine", icon: Image, prompt: "Shot on Canon EOS R5 with RF 100mm f/2.8L Macro, f/4, 1/125s, ISO 200. Softbox front-left, fill reflector right, subtle rim light. Editorial magazine product photography, crisp texture, shallow depth of field, 4K", promptZh: "Canon EOS R5 + RF 100mm f/2.8L微距镜头，f/4，1/125s，ISO 200。左前柔光箱，右侧补光反射板，轻微轮廓光。杂志级产品摄影，纹理清晰，浅景深，4K" },
  { key: "text_overlay", zh: "带文字", en: "With Text", icon: Square, prompt: "Product centered on white background, with elegant minimalist text overlay describing key features. Clean typography, professional layout, e-commerce infographic style, 8K, sharp text rendering, no watermarks", promptZh: "产品居中白底，附优雅极简文字标注描述核心卖点。清晰排版，专业布局，电商信息图风格，8K，文字清晰渲染" },
];

interface StylePickerProps {
  value: string | null;
  onChange: (key: string, prompt: string) => void;
  onReferenceImage?: (url: string | null) => void;
}

export function StylePicker({ value, onChange, onReferenceImage }: StylePickerProps) {
  const { t, locale } = useT();
  const isZh = locale === "zh";
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function select(s: StyleDef) {
    const prompt = isZh ? s.promptZh : s.prompt;
    onChange(s.key === value ? "" : s.key, s.key === value ? "" : prompt);
  }

  function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRefUrl(url);
    onReferenceImage?.(url);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("landing.nav.styles")}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {STYLES.map((s) => {
          const Icon = s.icon;
          const isActive = value === s.key;
          return (
            <button key={s.key} type="button" onClick={() => select(s)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                isActive ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500/20" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}>
              <Icon size={18} className={isActive ? "text-brand-600" : ""} />
              <span className="text-[10px] font-medium leading-tight text-center">{isZh ? s.zh : s.en}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg border border-dashed border-zinc-300 text-[10px] text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 transition-colors cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          {refUrl ? (isZh ? "已上传参考图" : "Reference set") : (isZh ? "参考风格图" : "Style Reference")}
        </button>
        {refUrl && <button type="button" onClick={() => { setRefUrl(null); onReferenceImage?.(null); }} className="text-[10px] text-red-400 hover:text-red-600 px-1">{isZh ? "清除" : "Clear"}</button>}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
      </div>
    </div>
  );
}
