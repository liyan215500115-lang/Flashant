"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";
import {
  applyCategoryChange,
  GENERAL_PACK,
  readPackDraft,
  writePackDraft,
} from "@/lib/studio-pack-session";
import { formatPackCreditSummaryFromPayload, packFailureReasonLabel } from "@/lib/generate/pack-summary";
import {
  createPackIdempotencyKey,
  isPackRequestDisconnect,
  onPackPostDisconnect,
  pollPackUntilSettled,
  type PackRunView,
} from "@/lib/generate/pack-run-client";
import { isInfoShot } from "@/lib/generate/info-shots";
import { noteFilledOnSelect, packShotRequest, persistedShotNotes } from "@/lib/generate/pack-shot-request";
import { downloadUrl } from "@/lib/download-image";
import { canvasImageFromViewedShot, viewedShotFileUrl } from "@/lib/viewed-shot";

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
    desc: "商品材质与结构微距，这件商品清晰可辨。美妆且参考图里有人才使用面部特写",
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
  in_use: "使用中",
  flatlay: "平铺展示",
  scene_atmosphere: "场景氛围",
  gift_accessory: "配件赠品",
};

interface StudioDetailPanelProps {
  projectId: string | null;
  productImageId: string;
  basePrompt: string;
  referenceImageUrl?: string;
  referenceHasPerson?: boolean;
  targetPlatform?: string;
  onDetailGenerated?: (results: Array<{key:string;url:string;label:string}>) => void;
  initialResults?: Array<{key:string; url:string; label:string; rawUrl:string; id?: string}>;
  initialFailures?: Array<{ key: string; reason: string }>;
  initialSummary?: string;
  onEngineResolved?: (selection: { engine: string; label: string }) => void;
  onPackSettled?: () => void;
  onViewShot?: (image: { id: string; url: string; promptUsed: string }) => void;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function StudioDetailPanel({ projectId, productImageId, basePrompt, referenceImageUrl, referenceHasPerson, targetPlatform, onDetailGenerated, initialResults, initialFailures, initialSummary, onEngineResolved, onPackSettled, onViewShot }: StudioDetailPanelProps) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(!!initialResults?.length);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(GENERAL_PACK));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(TYPE_GROUPS.filter((group) => group.types.some((type) => (GENERAL_PACK as readonly string[]).includes(type))).map((group) => group.key)),
  );
  const [perTypeDesc, setPerTypeDesc] = useState<Record<string, string>>({});
  const [showCustomDesc, setShowCustomDesc] = useState(false);
  const [generating, setGenerating] = useState(false);
  const requestRef = useRef(0);
  const packLock = useRef(false);
  const [enhancing, setEnhancing] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [results, setResults] = useState<Array<{ key: string; url: string; label: string; rawUrl: string; id?: string }>>([]);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [failures, setFailures] = useState<Array<{ key: string; reason: string }>>([]);
  const [batchSummary, setBatchSummary] = useState("");
  const [lightbox, setLightbox] = useState<{ id?: string; url: string; label: string } | null>(null);
  const [lockStyle, setLockStyle] = useState(false);
  const [category, setCategory] = useState("");

  // Category profiles matching route.ts CATEGORY_PROFILES
  const CATEGORIES: Array<{ key: string; name: string }> = [
    { key: "", name: "不限品类" },
    { key: "beauty", name: "美妆护肤" },
    { key: "fashion", name: "服饰配饰" },
    { key: "electronics", name: "3C数码" },
    { key: "food", name: "食品饮料" },
    { key: "home", name: "家居生活" },
    { key: "general", name: "通用" },
  ];

  // Recommended types per category — mirrors route.ts CATEGORY_PROFILES
  const CATEGORY_RECOMMEND: Record<string, string[]> = {
    beauty: ["selling_points", "detail", "material", "craft", "lifestyle", "scene_atmosphere"],
    fashion: ["in_use", "multi_angle", "detail", "flatlay", "color_variants", "lifestyle"],
    electronics: ["selling_points", "multi_angle", "detail", "compare", "lifestyle", "scene_atmosphere"],
    food: ["selling_points", "detail", "material", "flatlay", "lifestyle", "brand_story"],
    home: ["lifestyle", "scene_atmosphere", "in_use", "multi_angle", "flatlay", "brand_story"],
    general: ["selling_points", "detail", "multi_angle", "lifestyle"],
  };

  const handleCategoryChange = (catKey: string) => {
    const next = applyCategoryChange({
      category: catKey,
      recommended: CATEGORY_RECOMMEND,
      prompt: basePrompt,
      style: null,
      perTypeDesc,
      currentSelected: [...selected],
    });
    setCategory(catKey);
    setSelected(new Set(next.selected));
    setPerTypeDesc(next.perTypeDesc);
    setExpandedGroups(new Set(
      TYPE_GROUPS.filter((group) => group.types.some((type) => next.selected.includes(type))).map((group) => group.key),
    ));
  };

  const draftProject = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (draftProject.current !== projectId) {
      draftProject.current = projectId;
      const draft = readPackDraft(projectId);
      if (draft) {
        setSelected(new Set(draft.selected.length > 0 ? draft.selected : GENERAL_PACK));
        setCategory(draft.category);
        setLockStyle(draft.lockStyle);
        setPerTypeDesc(persistedShotNotes(draft.perTypeDesc));
        setOpen(draft.open || !!initialResults?.length);
      }
      return;
    }
    writePackDraft(projectId, {
      selected: [...selected],
      category,
      lockStyle,
      perTypeDesc,
      open,
    });
  }, [projectId, selected, category, lockStyle, perTypeDesc, open, initialResults?.length]);

  // Sync initialResults after async load (e.g. when project is fetched from API)
  useEffect(() => {
    if (initialResults?.length) {
      setResults(initialResults);
      setOpen(true);
    }
  }, [initialResults]);

  useEffect(() => {
    if (!initialSummary) return;
    setBatchSummary(initialSummary);
    setOpen(true);
  }, [initialSummary]);

  useEffect(() => {
    if (!initialFailures?.length) return;
    setFailures(initialFailures.map((failure) => ({
      key: failure.key,
      reason: packFailureReasonLabel(failure.reason, locale),
    })));
    setOpen(true);
    if (!initialSummary) {
      const completed = initialResults?.length ?? 0;
      setBatchSummary(`已完成 ${completed}/${completed + initialFailures.length}`);
    }
  }, [initialFailures, initialResults?.length, initialSummary, locale]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  };

  function seedShotNote(typeKey: string) {
    setPerTypeDesc((prev) => {
      const filled = noteFilledOnSelect({
        info: isInfoShot(typeKey),
        existingNote: prev[typeKey],
        basePrompt,
      });
      if (filled === null) return prev;
      return { ...prev, [typeKey]: filled };
    });
  }

  const toggleType = (typeKey: string) => {
    const adding = !selected.has(typeKey);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(typeKey)) next.delete(typeKey);
      else next.add(typeKey);
      return next;
    });
    if (adding) seedShotNote(typeKey);
  };

  const selectGroup = (types: string[]) => {
    const allSelected = types.every((typeKey) => selected.has(typeKey));
    setSelected(prev => {
      const next = new Set(prev);
      const groupSelected = types.every((typeKey) => next.has(typeKey));
      for (const typeKey of types) {
        if (groupSelected) next.delete(typeKey);
        else next.add(typeKey);
      }
      return next;
    });
    if (!allSelected) {
      for (const typeKey of types) seedShotNote(typeKey);
    }
  };

  function showPackView(view: PackRunView) {
    setBatchSummary(view.summary);
    setFailures(view.failures.map((failure) => ({
      key: failure.key,
      reason: packFailureReasonLabel(failure.reason, locale),
    })));
    if (view.engine.engine === "vega") onEngineResolved?.(view.engine);
    if (view.successes.length > 0) {
      const out = view.successes.map((shot) => ({
        key: shot.key,
        url: shot.url,
        rawUrl: shot.url,
        label: TYPE_LABELS[shot.key] || shot.label || shot.key,
        id: shot.id,
      }));
      setResults(out);
      onDetailGenerated?.(out);
    }
  }

  async function handleGenerate() {
    if (selected.size === 0 || !projectId || packLock.current) return;
    packLock.current = true;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const startedAt = Date.now();
    const packIdempotencyKey = createPackIdempotencyKey();
    setGenerating(true);
    setResults([]);
    setFailures([]);
    setBatchSummary("");
    setDownloadNotice("");
    const types = [...selected].map(key => ({ key, zh: TYPE_LABELS[key] || key }));

    const styleSeed = lockStyle ? Math.abs(hashString(projectId)) % 100000 : undefined;
    const styleRef = lockStyle ? (referenceImageUrl ?? undefined) : undefined;
    const finish = () => {
      if (requestRef.current !== requestId) return;
      packLock.current = false;
      setGenerating(false);
      onPackSettled?.();
    };

    const recoverFromDisconnect = async () => {
      setStageLabel(locale === "zh" ? "连接已中断，正在确认这组套图的结果…" : "Connection dropped. Checking this pack…");
      const recovered = await onPackPostDisconnect({
        error: new TypeError("Failed to fetch"),
        poll: () => pollPackUntilSettled({
          startedAt,
          locale,
          fetchProject: async () => {
            const projectRes = await fetch(`/api/products/${projectId}`);
            if (!projectRes.ok) throw new Error("Project poll failed");
            const body = await projectRes.json();
            return {
              status: body.project?.status,
              generatedImages: body.project?.generatedImages ?? [],
            };
          },
        }),
      });
      if (requestRef.current !== requestId) return;
      if (recovered.view) {
        showPackView(recovered.view);
        setStageLabel("");
        return;
      }
      setBatchSummary(locale === "zh"
        ? "连接已中断。请刷新页面查看这组套图的结果。"
        : "The connection dropped. Refresh this page to see this pack.");
      setStageLabel("");
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageProjectId: projectId,
          productImageId,
          detailTypes: types.map((t) => packShotRequest({
            key: t.key,
            label: t.zh,
            basePrompt,
            note: perTypeDesc[t.key] || "",
            info: isInfoShot(t.key),
          })),
          baseStyle: lockStyle ? basePrompt : undefined,
          referenceImageUrl: styleRef,
          referenceHasPerson: lockStyle ? referenceHasPerson === true : false,
          seed: styleSeed,
          targetPlatform: targetPlatform || undefined,
          numOutputs: 1,
          category: category || undefined,
          packIdempotencyKey,
        }),
      });
      let data: {
        generated?: Array<{ key: string; url: string; label?: string; id?: string }>;
        failed?: Array<{ key?: string; reason?: string }>;
        requested?: number;
        completed?: number;
        message?: string;
        error?: string;
        status?: string;
        poll?: boolean;
        engine?: string;
        modelVersion?: string;
        creditsCharged?: number;
        creditsRefunded?: number;
        creditsNotCharged?: number;
      };
      try {
        data = await res.json();
      } catch (error) {
        if (isPackRequestDisconnect(error) || error instanceof SyntaxError) {
          await recoverFromDisconnect();
          finish();
          return;
        }
        throw error;
      }
      if (requestRef.current !== requestId) return;
      if (data.status === "pack_in_progress" || data.poll === true) {
        await recoverFromDisconnect();
        finish();
        return;
      }
      if (data.engine === "vega" && data.modelVersion) {
        onEngineResolved?.({ engine: "vega", label: data.modelVersion });
      }
      const generated = data.generated;
      const failedShots = Array.isArray(data.failed) ? data.failed : [];
      const requested = typeof data.requested === "number" ? data.requested : types.length;
      const completed = typeof data.completed === "number" ? data.completed : (generated?.length ?? 0);
      setFailures(failedShots.map((shot) => ({
        key: shot.key || "unknown",
        reason: packFailureReasonLabel(shot.reason || data.message || "生成失败", locale),
      })));
      setBatchSummary(formatPackCreditSummaryFromPayload(data, { requested, completed }, locale));

      if (!res.ok && (!generated || generated.length === 0)) {
        const reason = packFailureReasonLabel(
          String(failedShots[0]?.reason || data.message || data.error || res.status),
          locale,
        );
        setBatchSummary(formatPackCreditSummaryFromPayload(data, { requested, completed }, locale) || reason);
        finish();
        return;
      }

      if (generated && Array.isArray(generated) && generated.length > 0) {
        const out: typeof results = [];
        for (const g of generated) {
          const label = TYPE_LABELS[g.key] || g.label || g.key;
          out.push({ key: g.key, url: g.url, rawUrl: g.url, label, id: g.id });
        }
        setResults(out);
        onDetailGenerated?.(out);
      } else if (failedShots.length === 0) {
        setBatchSummary(locale === "zh" ? "生成完成但没有返回图片，请重试。" : "Generation finished without an image. Please retry.");
      }
    } catch (error: unknown) {
      if (requestRef.current !== requestId) return;
      if (isPackRequestDisconnect(error)) {
        await recoverFromDisconnect();
      } else {
        const message = error instanceof Error ? error.message : "";
        setBatchSummary(message
          ? (locale === "zh" ? `请求没有完成：${message}` : `The request did not finish: ${message}`)
          : (locale === "zh" ? "请求没有完成，请刷新页面查看结果。" : "The request did not finish. Refresh to see the result."));
      }
    }
    finish();
  }

  function downloadFailedCopy() {
    return locale === "zh"
      ? "下载失败，页面会留在这里。请重试。"
      : "Couldn't download. This page stays open.";
  }

  function openShot(shot: { id?: string; url: string; label: string }) {
    setDownloadNotice("");
    setLightbox(shot);
    const canvas = canvasImageFromViewedShot(shot);
    if (canvas) onViewShot?.(canvas);
  }

  async function saveShot(shot: { id?: string; url: string; label: string }) {
    const target = viewedShotFileUrl(shot);
    if (!target) {
      setDownloadNotice(downloadFailedCopy());
      return;
    }
    const ok = await downloadUrl(target, `${shot.label || "flashant"}.png`);
    if (!ok) setDownloadNotice(downloadFailedCopy());
    else setDownloadNotice("");
  }

  const selectedCount = selected.size;
  const packTypeKeys = TYPE_GROUPS.flatMap((group) => group.types);
  const recommendedCount = category && CATEGORY_RECOMMEND[category]
    ? CATEGORY_RECOMMEND[category].length
    : GENERAL_PACK.length;
  const allTypesSelected = packTypeKeys.length > 0 && packTypeKeys.every((key) => selected.has(key));
  if (!projectId) return null;

  // Count selected per group for badge
  const groupSelection = (types: string[]) => types.filter(t => selected.has(t)).length;

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 p-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-3 w-full text-left group">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><FileText size={16} className="text-brand-600" /></div>
          <div className="flex-1"><p className="text-sm font-medium text-zinc-700">{t("studio.detailImages")}</p><p className="text-xs text-zinc-400">{selectedCount > 0 ? `已选 ${selectedCount} 张套图，消耗 ${selectedCount} 点额度` : t("studio.detailImagesDesc")}</p></div>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t("studio.detailImages")}</h3>
            <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600">收起</button>
          </div>

          {/* Category selector */}
          <div className="mb-3">
            <span className="text-[11px] font-medium text-zinc-500 mb-1 block">品类</span>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map(c => (
                <button key={c.key} type="button"
                  onClick={() => handleCategoryChange(c.key)}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                    category === c.key
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>
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
                            {(category ? CATEGORY_RECOMMEND[category] : [...GENERAL_PACK]).includes(typeKey) ? " · 荐" : ""}
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
                    placeholder={isInfoShot(typeKey) ? "规格文字（写在图上）" : "AI 视觉描述（不写字）"}
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

          {category && CATEGORY_RECOMMEND[category] && (
            <div className="mb-2 rounded-lg bg-brand-50 px-2.5 py-2 text-[11px] text-brand-800">
              推荐套图 · {CATEGORIES.find((item) => item.key === category)?.name} · {CATEGORY_RECOMMEND[category].length} 张
            </div>
          )}
          <p className="mb-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300" data-testid="pack-run-hint">
            {t("studio.packRunHint").replace("{n}", String(recommendedCount))}
          </p>
          {allTypesSelected && (
            <p className="mb-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300" data-testid="pack-all-selected">
              {t("studio.packAllTypesSelected")}
            </p>
          )}

          {/* Preview */}
          {selectedCount > 0 && !generating && (
            <div className="text-[10px] text-zinc-500 mb-2 text-center">
              将生成 {selectedCount} 张套图，消耗 {selectedCount} 点额度。失败的图片会退回额度。
              {TYPE_GROUPS.filter(g => groupSelection(g.types) > 0).length > 0 && (
                <span className="block text-zinc-400 mt-0.5">
                  {TYPE_GROUPS.filter(g => groupSelection(g.types) > 0).map(g => `${g.name}×${groupSelection(g.types)}`).join(" · ")}
                </span>
              )}
            </div>
          )}

          <Button onClick={handleGenerate} disabled={selectedCount === 0 || generating}
            size="sm" className="w-full gap-1.5 cursor-pointer rounded-xl bg-brand-900 hover:bg-brand-800 text-white">
            {generating && <Loader2 size={12} className="animate-spin" />}
            {generating ? (stageLabel || "生成中...") : selectedCount === 0 ? "请选择套图" : `生成 ${selectedCount} 张套图`}
          </Button>

          {batchSummary && (
            <p className="mt-2 text-[11px] text-center text-zinc-600">{batchSummary}</p>
          )}
          {downloadNotice && (
            <p className="mt-1 text-[11px] text-center text-red-600">{downloadNotice}</p>
          )}
          {failures.length > 0 && (
            <ul className="mt-2 space-y-1">
              {failures.map((failure) => (
                <li key={`${failure.key}-${failure.reason}`} className="rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700">
                  {(TYPE_LABELS[failure.key] || failure.key)} 失败：{packFailureReasonLabel(failure.reason, locale)}
                </li>
              ))}
            </ul>
          )}

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
                        <div key={i} className="group relative min-w-0 self-start rounded-lg overflow-hidden border border-zinc-200 hover:ring-2 hover:ring-brand-400 transition-all">
                          {/* The square lives on the button, not the img. aspect-ratio on the
                              replaced image was losing to the file's intrinsic box inside this
                              grid, and object-fit:cover then sliced some tiles into a top strip.
                              Every shot type shares this markup; the image is taken out of flow
                              so its pixel size cannot stretch or crop the tile. */}
                          <button
                            type="button"
                            data-testid="pack-result-thumb"
                            data-shot-key={r.key}
                            onClick={() => openShot(r)}
                            className="relative block w-full cursor-pointer overflow-hidden bg-zinc-50"
                            style={{ aspectRatio: "1 / 1", width: "100%", padding: 0, border: 0 }}
                          >
                            <img
                              src={r.url}
                              alt={r.label}
                              data-testid="pack-result-thumb-image"
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                objectPosition: "center",
                              }}
                            />
                          </button>
                          <div className="flex items-center justify-between px-1 pb-1">
                            <p className="text-[9px] text-zinc-600 truncate">{r.label}</p>
                            <button
                              type="button"
                              className="text-[9px] text-zinc-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                void saveShot(r);
                              }}>
                              下载
                            </button>
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
            <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-3 cursor-pointer" onClick={() => setLightbox(null)}>
              <img src={lightbox.url} alt={lightbox.label} className="max-w-[90vw] max-h-[80vh] rounded-xl shadow-2xl" onClick={(event) => event.stopPropagation()} />
              <button
                type="button"
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-800"
                onClick={(event) => {
                  event.stopPropagation();
                  void saveShot(lightbox);
                }}
              >
                下载
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
