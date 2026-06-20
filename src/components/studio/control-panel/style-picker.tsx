"use client";

import { useState, useRef } from "react";
import { Square, Image, User, Gem, Sun, Home, Coffee, Grid3X3, Layout } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface StyleDef {
  key: string; zh: string; en: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  prompt: string; promptZh: string;
}

const STYLES: StyleDef[] = [
  // 1. Main hero shot — clean white background, the #1 most important image (Amazon/Shopify both require it)
  { key: "white", zh: "纯白底", en: "White BG", icon: Square,
    prompt: "Professional e-commerce product photography on pure white background (RGB 255,255,255). Product centered, filling 85% of frame. Soft diffused studio lighting from two 45-degree angles, no harsh shadows, subtle ground contact shadow only. Commercial packshot quality, 8K, razor-sharp details, color-accurate, sRGB profile. No props, no text, no watermarks, no reflections",
    promptZh: "专业电商产品摄影，纯白背景（RGB 255,255,255）。产品居中，占画面85%。双侧45度柔光摄影棚灯光，无硬阴影，仅保留自然着地淡影。商业白底图标准，8K，超锐细节，色彩准确，sRGB。无道具、无文字、无水印、无倒影" },

  // 2. Lifestyle contextual — the #1 conversion booster per Shopify data (lifestyle photos increase purchase intent significantly)
  { key: "scene", zh: "场景图", en: "Lifestyle", icon: Image,
    prompt: "Premium lifestyle product photography in a curated, aspirational real-world setting. Product placed naturally as the hero of the composition. Bright modern interior with abundant natural window light, soft shadows, warm undertones. Editorial home/lifestyle magazine quality. Shallow depth of field blurs background slightly while keeping product in perfect focus. Authentic, lived-in feel — not sterile. 4K, photorealistic",
    promptZh: "高级生活方式产品摄影，精心布置的真实场景。产品自然作为视觉焦点。明亮现代室内，充足自然窗光，柔和阴影，暖色调。家居生活杂志级别。浅景深略微虚化背景，产品完美合焦。真实生活感，拒绝摆拍感。4K，照片级真实" },

  // 3. Model/in-use — showing product worn/used by real person, reduces returns by up to 22%
  { key: "in_use", zh: "模特图", en: "Model", icon: User,
    prompt: "Authentic lifestyle product photography showing a real person actively using or wearing the product. Candid, natural interaction — not forced posing. Soft diffused daylight, relaxed atmosphere. Model shown in a realistic setting appropriate to the product category (home, street, office, kitchen). Diversity-friendly. Focus on the product experience and fit, not the model. Magazine editorial quality, warm tones, 4K, photorealistic",
    promptZh: "真实生活方式摄影，真人自然使用或佩戴产品。抓拍式自然互动，非刻意摆拍。柔和漫射日光，松弛氛围。模特处于产品相关真实场景（居家、街拍、办公、厨房）。聚焦产品体验和佩戴效果，非模特本人。杂志编辑水准，温暖色调，4K，照片级真实" },

  // 4. Angled/multi-angle — shows product from front/back/side/45°, builds buyer confidence
  { key: "angles", zh: "多角度", en: "Multi-Angle", icon: Grid3X3,
    prompt: "Professional e-commerce multi-angle product photography composited into one clean layout. Show front, back, side, 45-degree top-down, and bottom views of the same product. Consistent pure white background across all angles. Uniform studio lighting, identical color temperature and exposure. Product maintains exact same scale across all views. Clean grid or flowing layout, no text. 8K, sharp detail, commercial catalog quality",
    promptZh: "专业电商多角度产品摄影合成布局。同一产品展示正面、背面、侧面、45度俯视、底部视图。所有角度统一纯白背景。一致摄影棚灯光，相同色温和曝光。各角度产品比例一致。干净网格或流式布局，无文字。8K，锐利细节，商业画册品质" },

  // 5. Luxury/marble — premium aesthetic for high-ticket items, used by Truff, Oura Ring etc.
  { key: "marble", zh: "奢华风", en: "Luxury", icon: Gem,
    prompt: "Ultra-premium luxury product photography. Product elegantly placed on genuine Carrara marble or dark walnut wood surface. Single directional soft key light raking across at 30 degrees, creating depth and texture. Subtle gold, brass, or matte black accents in the composition. Generous negative space (40-50% of frame). Muted, sophisticated color palette. High-end fashion/beauty/tech editorial style. Aspirational but tasteful. 4K, cinematic quality",
    promptZh: "超高端奢华产品摄影。产品优雅置于天然卡拉拉大理石或深色胡桃木表面。单一定向柔主光30度侧打，营造深度与质感。构图含低调金色、黄铜或哑光黑色点缀。大量留白（40-50%画面）。内敛高级色调。高端时尚/美妆/科技编辑风格。有格调的奢华感。4K，电影级品质" },

  // 6. Outdoor natural — golden hour glow, warm lifestyle, popular on Instagram/TikTok shops
  { key: "natural", zh: "户外自然", en: "Outdoor", icon: Sun,
    prompt: "Product photography in a natural outdoor environment during golden hour (first or last hour of sunlight). Warm, soft directional sunlight creates natural highlights and gentle shadows. Background: softly blurred natural greenery, stone texture, or open sky with warm tones. Product remains sharp and well-exposed. Organic, earthy, wellness-lifestyle aesthetic. Not overly staged — feels like a spontaneous beautiful moment. 4K, photorealistic, Instagram-worthy",
    promptZh: "户外自然环境产品摄影，黄金时段（日出后或日落前一小时）。温暖柔和的定向阳光营造自然高光与柔和阴影。背景：柔和虚化的自然绿植、石材质感或暖色调天空。产品保持清晰锐利曝光准确。有机、自然、健康生活方式美学。非刻意摆拍——如同偶遇的美好瞬间。4K，照片级真实，适合社交媒体" },

  // 7. Cosy home — warm Scandinavian/Japandi interior styling, high emotional connection
  { key: "cosy", zh: "温馨家", en: "Cosy Home", icon: Home,
    prompt: "Warm and inviting home interior product photography. Product naturally integrated into a thoughtfully styled living space. Soft diffused window light, linen textiles, warm wood tones, ceramic accents, dried botanicals. Scandinavian-Japandi fusion aesthetic: minimal but warm, functional but beautiful. Candlelight or gentle lamp glow adds atmosphere. Shallow depth of field, product in sharp focus. Editorial interior magazine quality. 4K, hygge atmosphere",
    promptZh: "温暖宜人的家居室内产品摄影。产品自然融入精心布置的生活空间。柔和漫射窗光，亚麻织物，暖木色调，陶瓷点缀，干花装饰。北欧侘寂融合美学：简约但温暖，实用且美观。烛光或柔和灯光增添氛围。浅景深，产品锐利合焦。室内设计杂志级别。4K，治愈氛围" },

  // 8. Dark & moody — cinematic single-light setup, premium brands like Truff, Aesop use this
  { key: "dark_moody", zh: "暗调高级", en: "Dark & Moody", icon: Coffee,
    prompt: "Dramatic cinematic product photography on deep charcoal or black background. Single hard key light from one side creates bold chiaroscuro — deep shadows with crisp edge definition. Product emerges from darkness with sculptural presence. Subtle rim light separates product edge from black void. Rich blacks, controlled highlights, intense contrast ratio. Premium independent brand aesthetic (Aesop, Le Labo, Byredo style). Ultra-premium feel, mysterious and exclusive. 4K",
    promptZh: "戏剧性电影级产品摄影，深炭黑或纯黑背景。单侧硬主光营造强烈明暗对比——深邃阴影与清晰边缘。产品从黑暗中浮现如雕塑般立体。微妙轮廓光勾勒产品边缘。浓郁黑色、精准高光、强烈对比度。高端独立品牌美学（Aesop、Le Labo、Byredo风格）。极致高级感，神秘而独特。4K" },

  // 9. Flat lay — overhead composition, popular for accessories, beauty, food, fashion
  { key: "flatlay", zh: "平铺图", en: "Flat Lay", icon: Layout,
    prompt: "Overhead flat lay product photography shot from directly above. Product as the centerpiece, surrounded by carefully curated complementary props (relevant accessories, natural elements, color-coordinated items). Clean neutral surface beneath — light wood, linen, or matte white. Soft even lighting from all sides, no harsh shadows. Organized yet organic composition with intentional negative space. Editorial catalog aesthetic, 8K, top-down perspective, Pinterest-worthy styling",
    promptZh: "俯拍平铺产品摄影，完全垂直向下拍摄。产品为中心，周围精心搭配辅助道具（相关配件、自然元素、同色系物品）。底部：浅木纹、亚麻布或哑光白表面。均匀柔光四面打光，无硬阴影。有序不失自然的构图，刻意留白。编辑目录美学，8K，俯视视角，Pinterest级别" },

  // 10. Infographic — feature callout images, proven 15-25% conversion lift on Amazon
  { key: "infographic", zh: "信息图", en: "Infographic", icon: Image,
    prompt: "Professional e-commerce infographic product image. Product on clean white or subtle gradient background on one side. Opposite side or overlay has elegant minimalist icons and short text callouts highlighting 3-5 key features, benefits, or specifications. Clean sans-serif typography, brand-consistent accent colors. Modern UI-inspired layout with subtle geometric lines or dividers. No clutter, each element has breathing room. Amazon A+ Content / Shopify PDP style. 8K, sharp text rendering",
    promptZh: "专业电商信息图产品图。产品置于干净白色或微渐变背景一侧。另一侧或叠加优雅极简图标和简短文字标注，突出3-5个核心卖点、优势或规格。清爽无衬线字体，品牌一致强调色。现代UI风格排版，微几何线条或分隔。不拥挤，每个元素有呼吸空间。亚马逊A+ / Shopify详情页风格。8K，文字清晰渲染" },
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
