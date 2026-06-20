"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/i18n-provider";

const DETAIL_TYPES = [
  // ═══ 信息类型：白底图文（Canvas 合成为主，AI 只出干净底图）═══

  // 1. 核心卖点 — 产品居中白底，文字后期合上去
  { key: "selling_points", label: "Core Selling Points", labelZh: "核心卖点",
    prompt: "Product centered on pure white background #FFFFFF, soft diffused studio lighting 5500K, no text, no labels, no watermarks, no icons, clean minimal e-commerce packshot, 4K, sharp product detail, plenty of negative space around product for text overlay" },

  // 2. 材质特写 — 极致微距，展示纹理
  { key: "material", label: "Material Texture", labelZh: "材质纹理",
    prompt: "Extreme macro close-up product photography on white background, 100mm macro lens at f/2.8, texture and material grain crisply visible — leather pores, fabric weave, wood grain, metal brushing, glass clarity. Shallow depth of field with focal point on the most impressive texture area. Soft diffused ring light, no harsh highlights. No text, no labels. Premium product detail photography, 8K" },

  // 3. 尺寸参考 — 通用参照物对比
  { key: "size", label: "Size Reference", labelZh: "尺寸参考",
    prompt: "Product on pure white background with a universally recognized scale object — standard soda can, US quarter coin, or metric ruler — placed beside it for instant size comprehension. Both product and scale object in same focal plane, equally sharp at f/8. Clean studio lighting 5500K. No text overlay, no labels. Professional e-commerce size reference photography, 4K" },

  // 4. 工艺细节 — 展示做工品质
  { key: "craft", label: "Craftsmanship", labelZh: "工艺细节",
    prompt: "Product on a clean white surface, hands-free still-life composition showing fine craftsmanship details — seam alignment, edge finishing, hardware attachment, material joining. Soft directional light raking across surface at 30 degrees to reveal subtle surface depth and texture. No people in frame. No text, no labels. Clean professional product photography, 4K" },

  // 5. 对比展示 — 双栏/分屏
  { key: "compare", label: "Comparison", labelZh: "对比展示",
    prompt: "Split-screen product comparison photography. Two views or variants of the same product side by side on pure white background. Identical lighting, identical scale, identical camera angle. Clean vertical dividing line centered. Left side and right side equally sharp at f/11. No text overlay, no labels. Suitable for before/after, color choice, or size comparison. Professional e-commerce layout, 8K" },

  // ═══ 场景与氛围类型 ═══

  // 6. 生活场景 — 产品在真实使用环境中
  { key: "lifestyle", label: "Lifestyle Scene", labelZh: "生活场景",
    prompt: "Authentic lifestyle product photography. Product naturally integrated into its intended real-world environment. For electronics: person using it on a clean desk, coffee nearby. For furniture: styled in a bright modern living room with window light. For beauty: on a bathroom vanity in soft morning light. For kitchenware: hands actively cooking in a warm kitchen. Candid editorial quality, soft natural daylight 5600K from left window. 50mm lens at f/2.2, product in sharp focus, background softly blurred. Not overly staged — relatable and aspirational. 4K, photorealistic, Kinfolk/Cereal magazine aesthetic" },

  // 7. 氛围感 — 情绪化产品大片
  { key: "scene_atmosphere", label: "Atmosphere", labelZh: "氛围大片",
    prompt: "Atmospheric emotional product photography with the product as the lone hero. Dramatic directional lighting — for electronics: product glowing alone on a dark wooden desk with dust motes in light beam. For candles/fragrance: single candle flickering in a dim cozy room with soft warm bokeh. For fashion: garment draped and blowing gently in wind against a misty morning backdrop. Deep emotional resonance, premium commercial photography. 85mm lens at f/1.8, ultra-shallow depth of field, product pin-sharp. 4K, cinematic, magazine editorial quality" },

  // 8. 使用展示 — 真人正在使用
  { key: "in_use", label: "In Use / Model", labelZh: "使用展示",
    prompt: "Authentic in-use product photography. The product being actively used or worn by a person — candid mid-action moment, not looking at camera. For wearables/earbuds: worn by model showing comfortable fit and scale. For smartwatches: on wrist with display visible. For kitchen tools: hands actively chopping or stirring. For beauty tools: applying on skin. Natural interaction, soft daylight 5500K, 50mm lens at f/2.0, focus on product. Editorial lifestyle quality, 4K, warm and relatable" },

  // 9. 多角度展示 — 五视图合成
  { key: "multi_angle", label: "Multi-Angle", labelZh: "多角度展示",
    prompt: "Professional multi-angle product photography composited into one clean layout. Five views: front, 45-degree front, side profile, rear, and top-down. All on pure white background #FFFFFF. Consistent lighting 5500K, identical scale across all views. Clean grid arrangement with equal spacing. No text overlay aside from optional 10px grey angle labels. 8K, commercial product catalog quality" },

  // 10. 细节放大 — 高品质微距
  { key: "detail", label: "Detail Close-Up", labelZh: "细节放大",
    prompt: "Extreme macro close-up emphasizing premium craftsmanship. 100mm macro lens at f/3.2, very shallow depth of field isolating one exquisite detail. For earbuds: ear tip silicone texture and charging contact precision. For watches: dial guilloche pattern and clasp mechanism. For bags: leather grain and zipper teeth quality. For kitchenware: blade edge sharpness and non-stick coating. Soft diffused light reveals fine detail without harsh reflections. 8K, premium inspection-grade quality" },

  // 11. 多色/多规格展示
  { key: "color_variants", label: "Color Variants", labelZh: "多色展示",
    prompt: "Product photography showing all available color or finish variants in one clean grid layout. Organized arrangement on pure white background. Consistent lighting and camera angle across every variant. Equal spacing and identical scale. For electronics: silver/black/blue/gold variants. For fashion: all seasonal colorways. For furniture: all wood or stain finish options. Professional catalog presentation, 8K, no text overlay" },

  // ═══ 包装与信任类型 ═══

  // 12. 平铺搭配 — 俯拍产品+配件
  { key: "flatlay", label: "Flat Lay", labelZh: "平铺搭配",
    prompt: "Overhead flat lay product photography shot from directly above. Product as the centerpiece, surrounded by carefully curated complementary accessories and lifestyle props. For electronics: braided USB cable, protective case, charging brick, desk mat, notebook. For beauty: brushes, other products, dried flowers, linen cloth. For food: fresh ingredients, wooden utensils, linens. Clean neutral surface — light oak or matte white. Soft even lighting from all sides, no harsh shadows. Organized yet organic composition with intentional negative space. Editorial catalog style, 8K, top-down perspective" },

  // 13. 品牌故事/开箱
  { key: "brand_story", label: "Unboxing Story", labelZh: "开箱故事",
    prompt: "Premium brand storytelling unboxing photography. Show the complete opening experience: outer packaging box with brand logo, tissue paper partially unwrapped, product nestled in its custom-fit insert, all included accessories neatly fanned out, warranty card and manual placed elegantly. Warm emotional lighting from window, 5000K. Overhead or 45-degree angle. Communicates care, quality, and gift-worthiness. The customer should feel the anticipation of opening this. 4K, editorial e-commerce quality, warm and aspirational" },

  // 14. 全家福/配件清单
  { key: "gift_accessory", label: "What's Included", labelZh: "配件清单",
    prompt: "Product photography showing the main product with all included accessories, cables, adapters, or complementary items that come in the box. Everything clearly visible and arranged neatly. For electronics: device + charger + USB cable + case + manual + SIM tool. For beauty: main product + travel size + applicator + pouch. Clean composition on white or light grey surface. Soft even studio lighting, all items equally sharp at f/11. No text labels on image — clean visual inventory. 8K, professional e-commerce quality" },
];

export default function DetailsPage() {
  const { t, locale } = useT();
  const isZh = locale === "zh";
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [productImages, setProductImages] = useState<Array<{ id: string; originalUrl: string }>>([]);
  const [selectedPt, setSelectedPt] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Array<{ key: string; url: string; label: string }>>([]);

  useEffect(() => {
    fetch(`/api/products/${projectId}`)
      .then((r) => r.json())
      .then((d) => setProductImages(d.project?.productImages ?? []))
      .catch(() => {});
  }, [projectId]);

  async function handleGenerate() {
    if (selectedPt.size === 0) return;
    setGenerating(true);
    const types = DETAIL_TYPES.filter((t) => selectedPt.has(t.key));

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: projectId,
          productImageId: productImages[0]?.id || "",
          detailTypes: types.map((t) => ({ key: t.key, prompt: t.prompt })),
          numOutputs: 1,
        }),
      });
      const data = await res.json();
      const { generated } = data;
      if (generated && Array.isArray(generated)) {
        const newResults: typeof results = generated.map(
          (g: { key: string; url: string; label: string }) => ({
            key: g.key, url: g.url, label: g.label,
          })
        );
        setResults((prev) => [...newResults, ...prev]);
        toast.success(`${newResults.length} detail images ready`);
      } else {
        toast.error(data.error || "Generation failed");
      }
    } catch {
      toast.error("Network failed");
    }
    setGenerating(false);
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/studio?projectId=${projectId}`} className="text-zinc-500 hover:text-zinc-700">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("studio.detailImages")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{t("studio.detailImagesDesc")}</p>
        </div>
        <Link href={`/projects/${projectId}/publish`}>
          <Button variant="outline" size="sm" className="cursor-pointer gap-1.5">
            <Send size={14} /> {isZh ? "发布/下载" : "Publish / Download"}
          </Button>
        </Link>
      </div>

      {/* Content type selector */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          {isZh ? "选择内容类型" : "Select Content Types"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {DETAIL_TYPES.map((dt) => (
            <button key={dt.key} type="button"
              onClick={() => setSelectedPt((prev) => { const n = new Set(prev); n.has(dt.key) ? n.delete(dt.key) : n.add(dt.key); return n; })}
              className={`text-left p-3 rounded-xl text-xs font-medium transition-colors duration-200 cursor-pointer border ${
                selectedPt.has(dt.key)
                  ? "bg-brand-100 border-brand-300 text-brand-800 dark:bg-brand-900/30 dark:border-brand-600 dark:text-brand-300"
                  : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
              }`}>
              <span className="block">{isZh ? dt.labelZh : dt.label}</span>
              <span className="block text-[10px] text-zinc-400 mt-1 line-clamp-2">{dt.prompt}</span>
            </button>
          ))}
        </div>
        <Button onClick={handleGenerate} disabled={selectedPt.size === 0 || generating}
          className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 rounded-xl">
          {generating && <Loader2 size={14} className="animate-spin" />}
          {generating ? t("detail.generating") : `${isZh ? "生成" : "Generate"} ${selectedPt.size || 0} ${isZh ? "张详情图" : " Detail Images"}`}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            {isZh ? "生成结果" : "Results"} ({results.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {results.map((r, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 group/img">
                <img src={r.url} alt={r.label} className="w-full aspect-square object-cover" />
                <div className="p-2"><p className="text-[11px] font-medium text-zinc-700">{r.label}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
