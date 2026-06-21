"use client";

import { useState } from "react";
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
  referenceImageUrl?: string;
  targetPlatform?: string;
  onDetailGenerated?: (results: Array<{key:string;url:string;label:string}>) => void;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Draw text onto a canvas and return as blob URL */
const INFO_TYPES = new Set(["selling_points", "material", "size", "craft", "compare"]);

async function overlayTextOnImage(imageUrl: string, text: string, label: string, isInfoType: boolean): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image(); i.crossOrigin = "anonymous"; i.onload = () => resolve(i); i.onerror = reject; i.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  if (text.trim()) {
    if (isInfoType) {
      // Info type: large centered text on clean white bg
      const fontSize = Math.max(32, Math.floor(img.width / 18));
      ctx.font = `700 ${fontSize}px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "center";
      const lines = text.split("\n");
      const lineHeight = fontSize * 1.4;
      const startY = img.height / 2 - (lines.length * lineHeight) / 2;
      lines.forEach((line, i) => ctx.fillText(line, img.width / 2, startY + i * lineHeight));
      ctx.textAlign = "left";
    } else {
      // Regular overlay: subtle bottom bar
      const fontSize = Math.max(18, Math.floor(img.width / 25));
      ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
      const barHeight = fontSize * 2;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, img.height - barHeight, img.width, barHeight);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(text, img.width / 2, img.height - barHeight / 2 + fontSize * 0.35);
      ctx.textAlign = "left";
    }
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), "image/png", 1.0));
}

export function StudioDetailPanel({ projectId, productImageId, basePrompt, referenceImageUrl, targetPlatform, onDetailGenerated }: StudioDetailPanelProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customDesc, setCustomDesc] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Array<{ key: string; url: string; label: string; rawUrl: string }>>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [lockStyle, setLockStyle] = useState(false);

  async function handleGenerate() {
    if (selected.size === 0 || !projectId) return;
    setGenerating(true);
    const types = DETAIL_TYPES.filter((d) => selected.has(d.key));

    // Deterministic seed from projectId — same project always gets same seed when locked
    const styleSeed = lockStyle ? Math.abs(hashString(projectId)) % 100000 : undefined;
    const styleRef = lockStyle ? (referenceImageUrl ?? undefined) : undefined;

    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: projectId,
          productImageId,
          detailTypes: types.map((t) => ({
            key: t.key,
            prompt: [t.zh, basePrompt, customDesc].filter(Boolean).join(" — "),
          })),
          baseStyle: lockStyle ? basePrompt : undefined,
          referenceImageUrl: styleRef,
          seed: styleSeed,
          targetPlatform: targetPlatform || undefined,
          numOutputs: 1,
        }),
      });
      const data = await res.json();
      const generated = data.generated as Array<{ key: string; url: string; label?: string }> | undefined;

      if (generated && Array.isArray(generated)) {
        const out: typeof results = [];
        for (const g of generated) {
          const label = g.label || g.key;
          // INFO types (尺寸/材质/成分/卖点/工艺/对比) are spec-sheet style:
          // the user's text should be rendered directly on the white-bg image.
          // Scene types (场景/氛围/使用中等) are pure photography — no text overlay.
          const isInfo = INFO_TYPES.has(g.key);
          const overlayedUrl = isInfo
            ? await overlayTextOnImage(g.url, customDesc, label, true).catch(() => g.url)
            : g.url;
          out.push({ key: g.key, url: overlayedUrl, rawUrl: g.url, label });
        }
        setResults((prev) => [...out, ...prev]);
        onDetailGenerated?.(out);
      }
    } catch {
      // silently fail
    }
    setGenerating(false);
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">{t("studio.detailImages")}</h3>
            <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600">收起</button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {DETAIL_TYPES.map((d) => (
              <button key={d.key} type="button"
                onClick={() => setSelected((prev) => { const n = new Set(prev); n.has(d.key) ? n.delete(d.key) : n.add(d.key); return n; })}
                className={`text-[10px] px-2 py-1.5 rounded-lg border transition-colors text-center cursor-pointer ${
                  selected.has(d.key) ? "bg-brand-100 border-brand-300 text-brand-700" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}>{d.zh}</button>
            ))}
          </div>
          <textarea value={customDesc} onChange={(e) => setCustomDesc(e.target.value)}
            placeholder="文字将叠加在图片上，如：材质：925纯银、高35cm×宽20cm..."
            rows={2}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none resize-none mb-2" />
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={lockStyle} onChange={(e) => setLockStyle(e.target.checked)} className="w-3.5 h-3.5 rounded accent-brand-600" />
            <span className="text-[11px] text-zinc-500">锁定风格一致性（套图模式）</span>
          </label>
          <Button onClick={handleGenerate} disabled={selectedCount === 0 || generating}
            size="sm" className="w-full gap-1.5 cursor-pointer rounded-xl bg-brand-900 hover:bg-brand-800 text-white">
            {generating && <Loader2 size={12} className="animate-spin" />}
            {generating ? "生成中..." : `生成 ${selectedCount} 张详情图`}
          </Button>
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {results.map((r, i) => (
                <div key={i} className="group relative rounded-lg overflow-hidden border border-zinc-200 hover:ring-2 hover:ring-brand-400 transition-all">
                  <button type="button" onClick={() => setLightbox(r.url)} className="w-full cursor-pointer">
                    <img src={r.url} alt={r.label} className="aspect-square object-cover w-full" />
                  </button>
                  <div className="flex items-center justify-between px-1 pb-1">
                    <p className="text-[9px] text-zinc-600 truncate">{r.label}</p>
                    <a href={r.rawUrl ?? r.url} download={`${r.label}.png`}
                      className="text-[9px] text-zinc-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}>
                      下载
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
          {lightbox && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer" onClick={() => setLightbox(null)}>
              <img src={lightbox} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
