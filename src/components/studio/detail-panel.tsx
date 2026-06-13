"use client";

import { useState, useMemo } from "react";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

const DETAIL_TYPES = [
  { key: "selling_points", zh: "核心卖点" },
  { key: "detail", zh: "细节特写" },
  { key: "material", zh: "材质成分" },
  { key: "size", zh: "尺寸参考" },
  { key: "multi_angle", zh: "多角度" },
  { key: "color_variants", zh: "颜色款式" },
  { key: "compare", zh: "效果对比" },
  { key: "brand_story", zh: "品牌故事" },
  { key: "craft", zh: "制作工艺" },
  { key: "lifestyle", zh: "使用场景" },
  { key: "flatlay", zh: "平铺展示" },
  { key: "scene_atmosphere", zh: "场景氛围" },
  { key: "gift_accessory", zh: "配件赠品" },
];

interface StudioDetailPanelProps {
  projectId: string | null;
  productImageId: string;
  basePrompt: string;
  onDetailGenerated?: () => void;
}

export function StudioDetailPanel({ projectId, productImageId, basePrompt, onDetailGenerated }: StudioDetailPanelProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Array<{ key: string; url: string; label: string }>>([]);

  async function handleGenerate() {
    if (selected.size === 0 || !projectId) return;
    setGenerating(true);
    const types = DETAIL_TYPES.filter((d) => selected.has(d.key));
    const out: typeof results = [];
    for (const t of types) {
      try {
        const res = await fetch("/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageProjectId: projectId, productImageId, detailType: t.key, baseStyle: basePrompt, numOutputs: 1 }),
        });
        const detailRes = await res.json() as { url?: string };
        if (detailRes.url) out.push({ key: t.key, url: detailRes.url, label: t.zh });
      } catch {}
    }
    setResults((prev) => [...out, ...prev]);
    setGenerating(false);
    onDetailGenerated?.();
  }

  const selectedCount = selected.size;

  if (!projectId) return null;

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-3 w-full text-left group">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><FileText size={16} className="text-brand-600" /></div>
          <div className="flex-1"><p className="text-sm font-medium text-zinc-700">{t("studio.detailImages")}</p><p className="text-xs text-zinc-400">{t("studio.detailImagesDesc")}</p></div>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t("studio.detailImages")}</h3>
            <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600">收起</button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {DETAIL_TYPES.map((d) => (
              <button key={d.key} type="button"
                onClick={() => setSelected((prev) => { const n = new Set(prev); n.has(d.key) ? n.delete(d.key) : n.add(d.key); return n; })}
                className={`text-[10px] px-2 py-1.5 rounded-lg border transition-colors text-center cursor-pointer ${
                  selected.has(d.key) ? "bg-brand-100 border-brand-300 text-brand-700" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}>
                {d.zh}
              </button>
            ))}
          </div>
          <Button onClick={handleGenerate} disabled={selectedCount === 0 || generating}
            size="sm" className="w-full gap-1.5 cursor-pointer rounded-xl bg-brand-900 hover:bg-brand-800 text-white">
            {generating && <Loader2 size={12} className="animate-spin" />}
            {generating ? "生成中..." : `生成 ${selectedCount} 张详情图`}
          </Button>
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {results.map((r, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-zinc-200">
                  <img src={r.url} alt={r.label} className="aspect-square object-cover w-full" />
                  <p className="text-[9px] p-1 text-zinc-600">{r.label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
