"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/i18n-provider";

const DETAIL_TYPES = [
  // #1 in every Shopify/Amazon guide: clean hero shot that fills 85%+ frame
  { key: "hero", label: "Hero Shot", labelZh: "主图（白底）",
    prompt: "Professional e-commerce hero product photography. Product centered on pure white background (RGB 255,255,255), filling 85% of frame. Soft even studio lighting from two 45-degree angles, no harsh shadows, subtle ground contact shadow only. Product front-facing, color-accurate. Commercial packshot standard. 8K, razor-sharp detail, no props, no text, no watermarks" },

  // Detail close-up — builds trust through transparency, shows quality
  { key: "detail", label: "Detail Close-up", labelZh: "细节特写",
    prompt: "Extreme macro close-up product photography. Focus on one key detail area: texture, stitching, material grain, logo placement, mechanism, or finish quality. Very shallow depth of field (f/2.8), product fills entire frame. Soft diffused lighting reveals fine surface detail without burning highlights. Premium quality inspection grade. Cracked leather grain, fabric weave, metal machining marks — show what the customer can't touch. 8K, 1:1 macro lens style" },

  // Size/scale — eliminates "is this too big/small?" hesitation, the #1 reason for returns
  { key: "size", label: "Size Reference", labelZh: "尺寸参考",
    prompt: "Product size reference photography for e-commerce. Product next to a universally recognized scale object (coin, standard soda can, ruler, or human hand gently holding). Clean white studio background. Both product and scale object in same focal plane, equally sharp. Helps customer instantly understand physical dimensions. Informative but visually clean — not cluttered. Professional catalog style, 4K, well-lit, no text overlay needed" },

  // Comparison — side-by-side, proven effective in Amazon A+ Content
  { key: "compare", label: "Comparison", labelZh: "对比展示",
    prompt: "Clean split-screen product comparison photography. Two products side by side in identical lighting and angle on white background. Shows different color variants, sizes, or before/after effect. Equal spacing, identical scale, same camera distance. Professional e-commerce comparison layout. Studio lighting consistent across both sides. 8K, sharp detail, commercial catalog quality. Suitable for Amazon comparison charts and Shopify variant displays" },

  // Material/craft — shows "why it's worth the price", used by premium brands
  { key: "craft", label: "Material & Craft", labelZh: "材质工艺",
    prompt: "Premium product material and craftsmanship photography. Highlight the quality of materials and construction. Close-up shots of material texture (leather grain, fabric weave, wood grain, metal finish), edge details, stitching precision, hardware quality. Warm, directional soft lighting creates subtle shadows that reveal surface depth. Workshop or studio setting. Communicates durability, quality, and justifies premium pricing. Editorial quality, 4K, shallow depth of field on focal area" },

  // Packaging/unboxing — shows what customer receives, proven to reduce post-purchase anxiety
  { key: "packaging", label: "Packaging & Unboxing", labelZh: "包装开箱",
    prompt: "Premium packaging and unboxing product photography. Show the complete unboxing experience: outer box, tissue paper, product nestled in insert, all included accessories, manuals, and extras neatly arranged. Warm, inviting lighting. Communicates care, quality, and gift-worthiness. Customer should feel excited to receive this package. Clean surface, organized layout, editorial e-commerce quality. 4K, bright and aspirational" },

  // Lifestyle scene — emotional connection, the conversion booster
  { key: "scene", label: "Lifestyle Scene", labelZh: "场景使用",
    prompt: "Authentic lifestyle product photography in a real-world setting. Product naturally integrated into its intended environment. For electronics: on a clean desk with coffee and notebook. For home goods: styled in a bright living room. For fashion: worn outdoors in natural light. Candid feel, not overly staged. Soft natural lighting, warm undertones. Shallow depth of field — product sharp, background softly blurred. Magazine editorial quality, aspirational but relatable. 4K, photorealistic" },
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
