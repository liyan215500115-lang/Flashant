"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/i18n-provider";

const DETAIL_TYPES = [
  // ═══ 信息类型：白底图 ═══
  { key: "selling_points", label: "Core Selling Points", labelZh: "核心卖点",
    prompt: "Product centered on pure white background #FFFFFF, soft diffused studio lighting 5500K, no text, no labels, no watermarks, clean minimal e-commerce packshot, plenty of negative space around product, 4K" },
  { key: "material", label: "Material Texture", labelZh: "材质纹理",
    prompt: "Extreme macro close-up product photography on white background, 100mm macro lens f/2.8, texture and material grain crisply visible, shallow depth of field, soft diffused ring light, no text, 8K" },
  { key: "size", label: "Size Reference", labelZh: "尺寸参考",
    prompt: "Product on white background next to a standard soda can for scale reference, both in same focal plane equally sharp at f/8, clean studio lighting, no text overlay, 4K" },
  { key: "craft", label: "Craftsmanship", labelZh: "工艺细节",
    prompt: "Product on a clean white surface, hands-free still-life showing fine details, seam alignment, edge finishing, material joining, soft directional light raking at 30 degrees to reveal surface texture, no text, 4K" },
  { key: "compare", label: "Comparison", labelZh: "对比展示",
    prompt: "Split-screen product comparison, two views side by side on pure white background, identical lighting scale and angle, clean vertical dividing line centered, f/11 equally sharp, no text overlay, 8K" },

  // ═══ 场景与氛围 ═══
  { key: "lifestyle", label: "Lifestyle Scene", labelZh: "生活场景",
    prompt: "Product in a bright modern interior with natural window light, soft daylight 5600K, 50mm lens f/2.2, product in sharp focus foreground, background softly blurred, editorial magazine quality, warm and aspirational, 4K" },
  { key: "scene_atmosphere", label: "Atmosphere", labelZh: "氛围大片",
    prompt: "Dramatic atmospheric product photography, product as the lone hero, directional lighting, 85mm lens f/1.8 ultra-shallow depth of field, product pin-sharp, cinematic mood, 4K" },
  { key: "in_use", label: "In Use", labelZh: "使用展示",
    prompt: "Product being naturally used or worn by a person, candid mid-action moment not looking at camera, soft daylight 5500K, 50mm lens f/2.0, focus on product, editorial lifestyle quality, warm and relatable, 4K" },
  { key: "multi_angle", label: "Multi-Angle", labelZh: "多角度展示",
    prompt: "Multi-angle product photography composited, front 45-degree side rear and top-down views, all on pure white background #FFFFFF, consistent lighting 5500K, identical scale, clean grid arrangement, 8K" },
  { key: "detail", label: "Detail Close-Up", labelZh: "细节放大",
    prompt: "Extreme macro close-up premium craftsmanship, 100mm macro lens f/3.2, very shallow depth of field isolating one exquisite detail, soft diffused light no harsh reflections, 8K" },
  { key: "color_variants", label: "Color Variants", labelZh: "多色展示",
    prompt: "Product color variants in one clean grid layout on pure white background, consistent lighting and camera angle across every variant, equal spacing identical scale, professional catalog presentation, 8K" },

  // ═══ 包装与信任 ═══
  { key: "flatlay", label: "Flat Lay", labelZh: "平铺搭配",
    prompt: "Overhead flat lay product photography from directly above, product surrounded by curated complementary accessories, clean neutral surface, soft even lighting, organized composition with negative space, editorial catalog style, 8K" },
  { key: "brand_story", label: "Unboxing Story", labelZh: "开箱故事",
    prompt: "Premium unboxing photography, outer packaging box, tissue paper, product in insert, all accessories neatly arranged, warm emotional window light 5000K, overhead or 45-degree angle, editorial e-commerce quality, 4K" },
  { key: "gift_accessory", label: "What's Included", labelZh: "配件清单",
    prompt: "Main product with all included accessories neatly arranged on white surface, soft even studio lighting, all items equally sharp at f/11, clean visual inventory, no text labels, professional e-commerce quality, 8K" },
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
            <Send size={14} /> {t("detail.publishDownload")}
          </Button>
        </Link>
      </div>

      {/* Content type selector */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          {t("detail.selectTypes")}
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
            </button>
          ))}
        </div>
        <Button onClick={handleGenerate} disabled={selectedPt.size === 0 || generating}
          className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 rounded-xl">
          {generating && <Loader2 size={14} className="animate-spin" />}
          {generating ? t("detail.generating") : t("detail.generateBtn").replace("{count}", String(selectedPt.size || 0))}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            {t("detail.results")} ({results.length})
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
