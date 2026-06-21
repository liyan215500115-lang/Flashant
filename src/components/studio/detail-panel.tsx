"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

const TYPE_GROUPS = [
  {
    name: "场景组",
    key: "scene",
    types: ["lifestyle", "scene_atmosphere", "in_use"],
    desc: "模特在真实场景中使用产品，统一人物形象",
  },
  {
    name: "特写组",
    key: "closeup",
    types: ["detail"],
    desc: "模特面部/手部特写，产品使用中，不带包装",
  },
  {
    name: "多角度",
    key: "angles",
    types: ["multi_angle"],
    desc: "产品正面/侧面/背面多角度展示",
  },
  {
    name: "平铺组",
    key: "flatlay",
    types: ["flatlay", "color_variants"],
    desc: "纯产品平铺展示 + 颜色款式",
  },
  {
    name: "规格组",
    key: "spec",
    types: ["selling_points", "material", "size", "craft", "compare"],
    desc: "白底 + 文字叠加（卖点/材质/尺寸/工艺/对比）",
  },
  {
    name: "品牌组",
    key: "brand",
    types: ["brand_story", "gift_accessory"],
    desc: "开箱场景 + 配件赠品展示",
  },
];

const TYPE_LABELS: Record<string, string> = {
  selling_points: "核心卖点",
  detail: "细节特写",
  material: "材质成分",
  size: "尺寸参考",
  multi_angle: "多角度",
  color_variants: "颜色款式",
  compare: "效果对比",
  brand_story: "品牌故事",
  craft: "制作工艺",
  lifestyle: "使用场景",
  flatlay: "平铺展示",
  scene_atmosphere: "场景氛围",
  gift_accessory: "配件赠品",
};

const INFO_TYPES = new Set(["selling_points", "material", "size", "craft", "compare"]);

interface StudioDetailPanelProps {
  projectId: string | null;
  productImageId: string;
  basePrompt: string;
  referenceImageUrl?: string;
  targetPlatform?: string;
  onDetailGenerated?: (results: Array<{key:string;url:string;label:string}>) => void;
  initialResults?: Array<{key:string; url:string; label:string; rawUrl:string}>;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

async function overlayTextOnImage(imageUrl: string, text: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image(); i.crossOrigin = "anonymous"; i.onload = () => resolve(i); i.onerror = reject; i.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  if (text.trim()) {
    const fontSize = Math.max(32, Math.floor(img.width / 18));
    ctx.font = `700 ${fontSize}px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    const lines = text.split("\n");
    const lineHeight = fontSize * 1.4;
    const startY = img.height / 2 - (lines.length * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, img.width / 2, startY + i * lineHeight));
    ctx.textAlign = "left";
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), "image/png", 1.0));
}

export function StudioDetailPanel({ projectId, productImageId, basePrompt, referenceImageUrl, targetPlatform, onDetailGenerated, initialResults }: StudioDetailPanelProps) {
  const { t } = useT();
  const [open, setOpen] = useState(!!initialResults?.length);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["scene", "spec"]));
  const [perTypeDesc, setPerTypeDesc] = useState<Record<string, string>>({});
  const [showCustomDesc, setShowCustomDesc] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Array<{ key: string; url: string; label: string; rawUrl: string }>>([]);

  // Sync initialResults after async load (e.g. when project is fetched from API)
  useEffect(() => {
    if (initialResults?.length) {
      setResults(initialResults);
      setOpen(true);
    }
  }, [initialResults]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [lockStyle, setLockStyle] = useState(false);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  };

  const toggleType = (typeKey: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(typeKey)) { next.delete(typeKey); } else { next.add(typeKey); if (!perTypeDesc[typeKey]) setPerTypeDesc(p => ({ ...p, [typeKey]: basePrompt })); }
      return next;
    });
  };

  const selectGroup = (types: string[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = types.every(t => next.has(t));
      for (const t of types) {
        if (allSelected) next.delete(t); else { next.add(t); if (!perTypeDesc[t]) setPerTypeDesc(p => ({ ...p, [t]: basePrompt })); }
      }
      return next;
    });
  };

  const [enhancing, setEnhancing] = useState(false);
  const [stageLabel, setStageLabel] = useState("");

  async function handleGenerate() {
    if (selected.size === 0 || !projectId) return;
    setGenerating(true);
    setStageLabel("优化提示词...");
    setEnhancing(true);
    const types = [...selected].map(key => ({ key, zh: TYPE_LABELS[key] || key }));

    const styleSeed = lockStyle ? Math.abs(hashString(projectId)) % 100000 : undefined;
    const styleRef = lockStyle ? (referenceImageUrl ?? undefined) : undefined;

    // Enhance prompts via AI for each detail type (in parallel, max 8s timeout)
    let enhancedPrompts: Record<string, string> = {};
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const enhancementResults = await Promise.allSettled(
        types.map(t =>
          fetch("/api/prompts/enhance", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: referenceImageUrl || undefined,
              productName: basePrompt || undefined,
              sellingPoints: perTypeDesc[t.key] || undefined,
              detailType: t.key,
              targetLanguage: "zh",
            }),
            signal: controller.signal,
          }).then(r => r.ok ? r.json() : { enhanced: "" }).then(d => ({ key: t.key, prompt: d.enhanced || "" }))
        )
      );
      clearTimeout(timeout);
      for (const r of enhancementResults) {
        if (r.status === "fulfilled" && r.value.prompt) {
          enhancedPrompts[r.value.key] = r.value.prompt;
        }
      }
    } catch { /* proceed without enhancement */ }
    setEnhancing(false);

    setStageLabel("生成图片...");
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: projectId,
          productImageId,
          detailTypes: types.map((t) => ({
            key: t.key,
            prompt: enhancedPrompts[t.key] || [TYPE_LABELS[t.key], basePrompt, perTypeDesc[t.key] || ""].filter(Boolean).join(" — "),
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
          const label = TYPE_LABELS[g.key] || g.label || g.key;
          const isInfo = INFO_TYPES.has(g.key);
          const desc = perTypeDesc[g.key] || "";
          const overlayedUrl = isInfo && desc.trim()
            ? await overlayTextOnImage(g.url, desc).catch(() => g.url)
            : g.url;
          out.push({ key: g.key, url: overlayedUrl, rawUrl: g.url, label });
        }
        setResults(out);
        onDetailGenerated?.(out);
      }
    } catch {
      // silently fail
    }
    setGenerating(false);
  }

  const selectedCount = selected.size;
  if (!projectId) return null;

  // Count selected per group for badge
  const groupSelection = (types: string[]) => types.filter(t => selected.has(t)).length;

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

          {/* Grouped type selection */}
          <div className="space-y-1 mb-3">
            {TYPE_GROUPS.map(group => {
              const expanded = expandedGroups.has(group.key);
              const count = groupSelection(group.types);
              return (
                <div key={group.key} className="rounded-lg border border-zinc-200 overflow-hidden">
                  {/* Group header — click to expand/collapse */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? <ChevronDown size={12} className="text-zinc-400" /> : <ChevronRight size={12} className="text-zinc-400" />}
                      <span className="text-xs font-medium text-zinc-700">{group.name}</span>
                      {count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">
                          {count}/{group.types.length}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); selectGroup(group.types); }}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md border cursor-pointer ${
                        count === group.types.length ? "bg-brand-500 text-white border-brand-500" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {count === group.types.length ? "清空" : "全选"}
                    </button>
                  </button>

                  {/* Group body */}
                  {expanded && (
                    <div className="px-2.5 pb-2">
                      <p className="text-[10px] text-zinc-400 mb-1.5">{group.desc}</p>
                      <div className="flex flex-wrap gap-1">
                        {group.types.map(typeKey => (
                          <button
                            key={typeKey}
                            type="button"
                            onClick={() => toggleType(typeKey)}
                            className={`text-[10px] px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                              selected.has(typeKey)
                                ? "bg-brand-100 border-brand-300 text-brand-700"
                                : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                            }`}
                          >
                            {TYPE_LABELS[typeKey] || typeKey}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Optional per-type descriptions */}
          <button type="button" onClick={() => setShowCustomDesc(s => !s)}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 mb-2 cursor-pointer">
            {showCustomDesc ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            自定义每张图的描述（可选）
          </button>
          {showCustomDesc && selected.size > 0 && (
            <div className="space-y-1.5 mb-2">
              {[...selected].map(typeKey => (
                <div key={`desc-${typeKey}`} className="flex items-start gap-1.5">
                  <span className="text-[10px] text-zinc-400 flex-shrink-0 mt-1.5 w-14 text-right">
                    {TYPE_LABELS[typeKey] || typeKey}
                  </span>
                  <input
                    type="text"
                    value={perTypeDesc[typeKey] ?? ""}
                    onChange={(e) => setPerTypeDesc(p => ({ ...p, [typeKey]: e.target.value }))}
                    placeholder={INFO_TYPES.has(typeKey) ? "规格文字（写在图上）" : "AI 视觉描述（不写字）"}
                    className="flex-1 rounded-md border border-zinc-200 px-2 py-1 text-[10px] placeholder:text-zinc-300 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={lockStyle} onChange={(e) => setLockStyle(e.target.checked)} className="w-3.5 h-3.5 rounded accent-brand-600" />
            <span className="text-[11px] text-zinc-500">锁定风格一致性（套图模式）</span>
          </label>

          {/* Preview */}
          {selectedCount > 0 && !generating && (
            <div className="text-[10px] text-zinc-400 mb-2 text-center">
              将生成 {selectedCount} 张详情图：{TYPE_GROUPS.filter(g => groupSelection(g.types) > 0).map(g => `${g.name}×${groupSelection(g.types)}`).join(" · ")}
            </div>
          )}

          <Button onClick={handleGenerate} disabled={selectedCount === 0 || generating}
            size="sm" className="w-full gap-1.5 cursor-pointer rounded-xl bg-brand-900 hover:bg-brand-800 text-white">
            {generating && <Loader2 size={12} className="animate-spin" />}
            {generating ? (stageLabel || "生成中...") : `生成 ${selectedCount} 张套图`}
          </Button>

          {/* Results by group */}
          {results.length > 0 && (
            <div className="mt-3 space-y-3">
              {TYPE_GROUPS.map(group => {
                const groupResults = results.filter(r => group.types.includes(r.key));
                if (groupResults.length === 0) return null;
                return (
                  <div key={group.key}>
                    <p className="text-[10px] font-medium text-zinc-500 mb-1">{group.name}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {groupResults.map((r, i) => (
                        <div key={i} className="group relative rounded-lg overflow-hidden border border-zinc-200 hover:ring-2 hover:ring-brand-400 transition-all">
                          <button type="button" onClick={() => setLightbox(r.url)} className="w-full cursor-pointer">
                            <img src={r.url} alt={r.label} className="aspect-square object-cover w-full" />
                          </button>
                          <div className="flex items-center justify-between px-1 pb-1">
                            <p className="text-[9px] text-zinc-600 truncate">{r.label}</p>
                            <a href={r.rawUrl ?? r.url} download={`${r.label}.png`}
                              className="text-[9px] text-zinc-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-all"
                              onClick={(e) => e.stopPropagation()}>
                              下载
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
