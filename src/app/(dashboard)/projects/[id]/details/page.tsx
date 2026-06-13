"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const DETAIL_TYPES = [
  { key: "selling_points", label: "Core Selling Points", labelZh: "核心卖点图", prompt: "Product key selling points infographic style, highlighted features with clean callout text, white background, e-commerce product page section, professional layout, 8K" },
  { key: "detail", label: "Detail Close-up", labelZh: "商品细节图", prompt: "Extreme macro close-up product detail shot, texture and material clearly visible, premium product photography, shallow depth of field, 8K" },
  { key: "size", label: "Size Guide", labelZh: "尺寸/容量图", prompt: "Product size comparison with measurement reference, dimensional guide overlay, clean studio lighting, informative layout, scale reference" },
  { key: "compare", label: "Before/After", labelZh: "效果对比图", prompt: "Before and after comparison, split screen layout, product transformation showcase, side by side, professional presentation" },
  { key: "craft", label: "Craftsmanship", labelZh: "工艺制作图", prompt: "Artisan craftsmanship process scene, hands carefully making the product, workshop environment, warm natural lighting, authentic handmade feel" },
  { key: "series", label: "Series Collection", labelZh: "系列展示图", prompt: "Product family lineup, multiple color variants or styles displayed together, organized grid layout, collection showcase, premium brand presentation" },
  { key: "scene", label: "Lifestyle Scene", labelZh: "场景使用图", prompt: "Product in real-life use scenario, lifestyle photography, natural environment, candid authentic moment, magazine quality" },
];

export default function DetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [productImages, setProductImages] = useState<Array<{ id: string; originalUrl: string }>>([]);
  const [selectedPt, setSelectedPt] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Array<{ key: string; url: string; label: string }>>([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => setProductImages(d.project?.productImages ?? []))
      .catch(() => {});
  }, [projectId]);

  async function handleGenerate() {
    if (selectedPt.size === 0) return;
    setGenerating(true);
    const types = DETAIL_TYPES.filter((t) => selectedPt.has(t.key));
    const newResults: typeof results = [];

    for (const t of types) {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageProjectId: projectId,
            productImageId: productImages[0]?.id || "",
            prompt: t.prompt,
            numOutputs: 1,
          }),
        });
        const data = await res.json();
        if (data.url) newResults.push({ key: t.key, url: data.url, label: t.label });
      } catch { /* skip */ }
    }
    setResults((prev) => [...newResults, ...prev]);
    setGenerating(false);
    toast.success(`${newResults.length} detail images ready`);
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/projects/${projectId}`} className="text-zinc-500 hover:text-zinc-700">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Detail Images</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Select content types and generate product listing detail images</p>
        </div>
        <Link href={`/projects/${projectId}/publish`}>
          <Button variant="outline" size="sm" className="cursor-pointer gap-1.5">
            <Send size={14} /> Publish / Download
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Select Content Types</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {DETAIL_TYPES.map((dt) => (
            <button key={dt.key} type="button"
              onClick={() => setSelectedPt((prev) => { const n = new Set(prev); n.has(dt.key) ? n.delete(dt.key) : n.add(dt.key); return n; })}
              className={`text-left p-3 rounded-xl text-xs font-medium transition-colors duration-200 cursor-pointer border ${
                selectedPt.has(dt.key)
                  ? "bg-brand-100 border-brand-300 text-brand-800 dark:bg-brand-900/30 dark:border-brand-600 dark:text-brand-300"
                  : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
              }`}>
              <span className="block">{dt.label}</span>
              <span className="block text-[10px] text-zinc-400 mt-1 line-clamp-2">{dt.prompt}</span>
            </button>
          ))}
        </div>
        <Button onClick={handleGenerate} disabled={selectedPt.size === 0 || generating}
          className="bg-brand-900 hover:bg-brand-800 text-white cursor-pointer gap-2 rounded-xl">
          {generating && <Loader2 size={14} className="animate-spin" />}
          {generating ? "Generating..." : `Generate ${selectedPt.size || 0} Detail Images`}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Results ({results.length})</h2>
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
