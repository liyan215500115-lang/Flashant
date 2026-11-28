"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Download,
  ImageOff,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { AiEditLink } from "@/components/project/ai-edit-link";
import { QuotaRemainingBadge } from "@/components/project/quota-badge";
import "./project-detail.css";
import { fillTemplate } from "@/lib/generated-image-display";
import {
  continuePlacement,
  detailViewportFromWidth,
  emptyPlacement,
  galleryColumns,
  headerActionState,
  shotSummary,
  statusPill,
  type DetailViewport,
} from "@/lib/project-detail-layout";

export interface DetailShotModel {
  id: string;
  kind: "original" | "generated";
  src: string | null;
  alt: string;
  fileName: string;
}

export interface DetailQuotaModel {
  status: "loading" | "ready" | "error";
  value: string;
  exhausted: boolean;
  onRetry: () => void;
}

function useDetailViewport(): DetailViewport {
  const [viewport, setViewport] = useState<DetailViewport>("wide");
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const phone = window.matchMedia("(max-width: 520px)");
    const narrow = window.matchMedia("(max-width: 800px)");
    const update = () => setViewport(detailViewportFromWidth(window.innerWidth));
    update();
    phone.addEventListener("change", update);
    narrow.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      phone.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return viewport;
}

function useFinePointer() {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => document.documentElement.classList.toggle("can-hover", fine.matches);
    update();
    fine.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      document.documentElement.classList.remove("can-hover");
    };
  }, []);
}

export function ProjectBackLink() {
  const { t } = useT();
  return (
    <Link href="/projects" className="pd-back" data-testid="back-to-projects">
      <span className="pd-back-icon" aria-hidden="true">
        <ArrowLeft size={16} strokeWidth={2} />
      </span>
      {t("sidebar.products")}
    </Link>
  );
}

export function ProjectDetailLoading({ quota }: { quota: DetailQuotaModel }) {
  const { t } = useT();
  useFinePointer();
  return (
    <div className="project-detail">
      <div className="pd-canvas">
        <header className="pd-header">
          <ProjectBackLink />
          <div className="pd-header-row">
            <div className="pd-identity" data-testid="project-identity">
              <div className="pd-skel-title" />
              <div className="pd-meta">
                <QuotaRemainingBadge
                  label={t("detail.quotaRemaining")}
                  status={quota.status}
                  value={quota.value}
                  retryLabel={t("detail.quotaRetry")}
                  exhausted={quota.exhausted}
                  onRetry={quota.onRetry}
                />
              </div>
            </div>
          </div>
        </header>
        <section className="pd-gallery" aria-busy="true" aria-labelledby="gallery-title">
          <header className="pd-gallery-bar">
            <h2 id="gallery-title">
              {t("detail.shots")} <span className="pd-count">{t("detail.galleryLoading")}</span>
            </h2>
          </header>
          <ul className="pd-shot-grid cols-3">
            <li><div className="pd-skel-shot" /></li>
            <li><div className="pd-skel-shot" /></li>
            <li><div className="pd-skel-shot" /></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function StudioLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
      {children}
    </>
  );
}

function EmptyCopy({
  projectId,
  body,
  well,
}: {
  projectId: string;
  body: string;
  well?: boolean;
}) {
  const { t } = useT();
  return (
    <div className={well ? "pd-empty is-well" : "pd-empty"}>
      <h3 data-testid="gallery-empty-title">{t("detail.noShotsTitle")}</h3>
      <p>{body}</p>
      <AiEditLink projectId={projectId} variant="outline" testId="gallery-empty-studio" title={t("detail.openStudioTitle")}>
        <StudioLabel>{t("detail.aiEdit")}</StudioLabel>
      </AiEditLink>
    </div>
  );
}

export function ProjectDetailView({
  projectId,
  title,
  shots,
  originalCount,
  generatedCount,
  downloadableCount,
  editMode,
  selectedIds,
  quota,
  generating,
  viewport: viewportProp,
  onDownloadAll,
  onEnterSelect,
  onExitSelect,
  onDeleteProject,
  onToggleShot,
  onOpenShot,
  onEditShot,
  onDownloadShot,
  onDeleteShot,
  onAddText,
  onRegenerateSelected,
  onBatchDelete,
  onReorder,
  onDropOriginal,
  onShotLoad,
  onShotError,
  footer,
}: {
  projectId: string;
  title: string;
  shots: DetailShotModel[];
  originalCount: number;
  generatedCount: number;
  downloadableCount: number;
  editMode: boolean;
  selectedIds: ReadonlySet<string>;
  quota: DetailQuotaModel;
  generating: boolean;
  viewport?: DetailViewport;
  onDownloadAll: () => void;
  onEnterSelect: () => void;
  onExitSelect: () => void;
  onDeleteProject: () => void;
  onToggleShot: (id: string) => void;
  onOpenShot: (id: string) => void;
  onEditShot: (id: string) => void;
  onDownloadShot: (id: string) => void;
  onDeleteShot: (id: string) => void;
  onAddText: () => void;
  onRegenerateSelected: () => void;
  onBatchDelete: () => void;
  onReorder?: (fromId: string, toId: string) => void;
  onDropOriginal?: (payload: { url: string; name: string; productImageId: string }) => void;
  onShotLoad?: (id: string) => void;
  onShotError?: (id: string) => void;
  footer?: ReactNode;
}) {
  const { t } = useT();
  const measured = useDetailViewport();
  const viewport = viewportProp ?? measured;
  useFinePointer();

  const sourceOnly = generatedCount <= 0 && originalCount > 0;
  const columns = galleryColumns({ viewport, tileCount: shots.length, sourceOnly });
  const summary = shotSummary(originalCount, generatedCount);
  const pill = statusPill({ loading: false, generatedCount });
  const actions = headerActionState({ downloadableCount, originalCount, generatedCount });
  const empty = emptyPlacement({ originalCount, generatedCount, columns });
  const continueMode = continuePlacement({
    selecting: editMode,
    generatedCount,
    tileCount: shots.length,
    columns,
  });
  const selectedCount = selectedIds.size;

  function run(enabled: boolean, action: () => void) {
    if (!enabled) return;
    action();
  }

  function onDragStart(event: DragEvent<HTMLDivElement>, shot: DetailShotModel) {
    if (editMode) return;
    event.dataTransfer.setData("source", shot.kind);
    event.dataTransfer.setData("id", shot.id);
    if (shot.kind === "original") {
      event.dataTransfer.setData("url", shot.src ?? "");
      event.dataTransfer.setData("name", shot.fileName);
      event.dataTransfer.setData("productImageId", shot.id);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>, shot: DetailShotModel) {
    if (editMode || shot.kind !== "generated") return;
    event.preventDefault();
    const source = event.dataTransfer.getData("source");
    if (source === "generated") onReorder?.(event.dataTransfer.getData("id"), shot.id);
    if (source === "original") {
      onDropOriginal?.({
        url: event.dataTransfer.getData("url"),
        name: event.dataTransfer.getData("name"),
        productImageId: event.dataTransfer.getData("productImageId"),
      });
    }
  }

  const continueTile = (
    <AiEditLink projectId={projectId} variant="tile" testId="gallery-continue" title={t("detail.continueInStudioHint")}>
      <span className="pd-plus" aria-hidden="true"><Plus size={16} strokeWidth={1.8} /></span>
      <strong>{t("detail.continueInStudio")}</strong>
      <span>{t("detail.continueInStudioHint")}</span>
    </AiEditLink>
  );

  return (
    <div className="project-detail">
      <div className="pd-canvas">
        <header className="pd-header">
          <ProjectBackLink />
          <div className="pd-header-row">
            <div className="pd-identity" data-testid="project-identity">
              <h1 className="pd-title line-clamp-2">{title}</h1>
              <div className="pd-meta">
                {pill && (
                  <span
                    className={`pd-status ${pill === "generated" ? "is-generated" : "is-pending"}`}
                    data-testid="status-pill"
                    data-state={pill}
                  >
                    {pill === "generated" ? t("status.GENERATED") : t("detail.notGenerated")}
                  </span>
                )}
                <QuotaRemainingBadge
                  label={t("detail.quotaRemaining")}
                  status={quota.status}
                  value={quota.value}
                  retryLabel={t("detail.quotaRetry")}
                  exhausted={quota.exhausted}
                  onRetry={quota.onRetry}
                />
              </div>
            </div>
            {editMode ? (
              <div className="pd-toolbar" role="toolbar" aria-label={t("detail.selectedActions")} data-testid="project-toolbar" data-mode="select">
                <span className="pd-hint" data-testid="selected-count">
                  {fillTemplate(t("detail.selectedCount"), { count: selectedCount })}
                </span>
                <button
                  type="button"
                  className="pd-btn pd-btn-outline"
                  data-testid="action-add-text"
                  disabled={selectedCount === 0}
                  onClick={() => run(selectedCount > 0, onAddText)}
                >
                  <Type size={16} strokeWidth={1.8} aria-hidden="true" />
                  {t("detail.addText")}
                </button>
                <button
                  type="button"
                  className="pd-btn pd-btn-outline"
                  data-testid="action-regenerate"
                  disabled={selectedCount === 0}
                  onClick={() => run(selectedCount > 0, onRegenerateSelected)}
                >
                  <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
                  {t("detail.regenerateShort")}
                </button>
                <button
                  type="button"
                  className="pd-btn pd-btn-danger"
                  data-testid="action-batch-delete"
                  disabled={selectedCount === 0}
                  onClick={() => run(selectedCount > 0, onBatchDelete)}
                >
                  <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                  {t("detail.delete")}
                </button>
                <button type="button" className="pd-btn pd-btn-primary" data-testid="action-done" data-emphasis="primary" onClick={onExitSelect}>
                  {t("detail.doneSelecting")}
                </button>
              </div>
            ) : (
              <div className="pd-toolbar" role="toolbar" aria-label={t("detail.projectActions")} data-testid="project-toolbar" data-mode="default">
                <button
                  type="button"
                  className={actions.downloadEnabled ? "pd-btn pd-btn-primary" : "pd-btn pd-btn-outline"}
                  data-testid="action-download"
                  data-emphasis={actions.primary === "download" ? "primary" : "secondary"}
                  disabled={!actions.downloadEnabled}
                  onClick={() => run(actions.downloadEnabled, onDownloadAll)}
                >
                  <Download size={16} strokeWidth={1.8} aria-hidden="true" />
                  {t("detail.download")}
                </button>
                {actions.publishEnabled ? (
                  <Link
                    href={`/projects/${projectId}/publish`}
                    className="pd-btn pd-btn-outline"
                    data-testid="action-publish"
                  >
                    <ShoppingBag size={16} strokeWidth={1.8} aria-hidden="true" />
                    {t("detail.publishShopify")}
                  </Link>
                ) : (
                  <button type="button" className="pd-btn pd-btn-outline" data-testid="action-publish" disabled>
                    <ShoppingBag size={16} strokeWidth={1.8} aria-hidden="true" />
                    {t("detail.publishShopify")}
                  </button>
                )}
                <AiEditLink
                  projectId={projectId}
                  variant={actions.primary === "studio" ? "primary" : "outline"}
                  testId="action-studio"
                  title={t("detail.openStudioTitle")}
                >
                  <StudioLabel>{t("detail.aiEdit")}</StudioLabel>
                </AiEditLink>
                <button
                  type="button"
                  className="pd-btn pd-btn-outline"
                  data-testid="action-select"
                  disabled={!actions.selectEnabled}
                  onClick={() => run(actions.selectEnabled, onEnterSelect)}
                >
                  <Check size={16} strokeWidth={1.8} aria-hidden="true" />
                  {t("detail.selectImages")}
                </button>
                <button
                  type="button"
                  className="pd-btn pd-btn-danger"
                  data-testid="action-delete"
                  onClick={onDeleteProject}
                >
                  <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                  {t("detail.delete")}
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="pd-gallery" aria-labelledby="gallery-title">
          <header className="pd-gallery-bar">
            <h2 id="gallery-title">
              {t("detail.shots")}{" "}
              <span className="pd-count" data-testid="shot-count">
                {fillTemplate(t("detail.shotCount"), { count: generatedCount })}
              </span>
              {summary === "source" && (
                <span className="pd-sub" data-testid="shot-sub">
                  {" "}· {fillTemplate(t("detail.hasOriginals"), { count: originalCount })}
                </span>
              )}
              {summary === "mixed" && (
                <span className="pd-sub" data-testid="shot-sub">
                  {" "}· {fillTemplate(t("detail.alsoOriginals"), { count: originalCount })}
                </span>
              )}
            </h2>
            {generating && <p className="pd-generating">{t("detail.generating")}</p>}
          </header>

          {empty === "full" ? (
            <EmptyCopy projectId={projectId} body={t("detail.noShotsEmpty")} well />
          ) : (
            <ul className={`pd-shot-grid cols-${columns}`} data-testid="shot-grid" data-columns={columns}>
              {shots.map((shot) => {
                const selected = selectedIds.has(shot.id);
                return (
                  <li key={shot.id}>
                    <div
                      className={`pd-shot${editMode ? " is-select" : ""}${selected ? " is-selected" : ""}`}
                      data-testid="shot"
                      data-shot-id={shot.id}
                      data-kind={shot.kind}
                      data-selected={selected ? "true" : "false"}
                      draggable={!editMode}
                      onDragStart={(event) => onDragStart(event, shot)}
                      onDragOver={(event) => {
                        if (!editMode && shot.kind === "generated") event.preventDefault();
                      }}
                      onDrop={(event) => onDrop(event, shot)}
                    >
                      <button
                        type="button"
                        className="pd-open"
                        data-testid="shot-open"
                        aria-label={fillTemplate(t("detail.viewShot"), { name: shot.alt || t("detail.shots") })}
                        aria-pressed={editMode ? selected : undefined}
                        onClick={() => (editMode ? onToggleShot(shot.id) : onOpenShot(shot.id))}
                      >
                        {shot.src ? (
                          <img
                            src={shot.src}
                            alt={shot.alt}
                            onLoad={() => onShotLoad?.(shot.id)}
                            onError={() => onShotError?.(shot.id)}
                          />
                        ) : (
                          <span className="pd-missing">
                            <ImageOff size={18} aria-hidden="true" />
                            {t("detail.imageUnavailable")}
                          </span>
                        )}
                      </button>
                      {shot.kind === "original" && (
                        <span className="pd-shot-tag">{t("detail.originalBadge")}</span>
                      )}
                      {editMode && (
                        <span className="pd-shot-check" aria-hidden="true">
                          <Check size={14} strokeWidth={2.4} />
                        </span>
                      )}
                      {!editMode && (
                        <div className="pd-shot-dock">
                          {shot.src && (
                            <button
                              type="button"
                              className="pd-act pd-act-edit"
                              data-testid="shot-edit"
                              title={t("detail.editLocalHint")}
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditShot(shot.id);
                              }}
                            >
                              <Pencil size={13} strokeWidth={1.8} aria-hidden="true" />
                              {t("detail.edit")}
                            </button>
                          )}
                          {shot.src && (
                            <button
                              type="button"
                              className="pd-act pd-act-icon"
                              data-testid="shot-download"
                              aria-label={t("detail.downloadThis")}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDownloadShot(shot.id);
                              }}
                            >
                              <Download size={13} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="pd-act pd-act-icon pd-act-danger"
                            data-testid="shot-delete"
                            aria-label={t("detail.deleteThis")}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteShot(shot.id);
                            }}
                          >
                            <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              {empty === "beside" && (
                <li>
                  <EmptyCopy projectId={projectId} body={t("detail.noShotsSource")} />
                </li>
              )}
              {continueMode === "tile" && <li>{continueTile}</li>}
            </ul>
          )}

          {empty === "below" && (
            <div className="mt-4">
              <EmptyCopy projectId={projectId} body={t("detail.noShotsSource")} well />
            </div>
          )}
          {continueMode === "bar" && (
            <AiEditLink projectId={projectId} variant="bar" testId="gallery-continue" title={t("detail.continueInStudioHint")}>
              <span className="pd-plus" aria-hidden="true"><Plus size={14} strokeWidth={1.8} /></span>
              {t("detail.continueInStudio")}
            </AiEditLink>
          )}
        </section>
        {footer}
      </div>
    </div>
  );
}
