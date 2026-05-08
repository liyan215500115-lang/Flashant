import type { PipelineStatus } from "@prisma/client";

const STATUS_ORDER: PipelineStatus[] = [
  "PARSING",
  "SCRIPTING",
  "GENERATING_IMAGES",
  "GENERATING_VIDEO",
  "GENERATING_AUDIO",
  "REVIEW",
  "APPROVED",
  "PUBLISHING",
  "PUBLISHED",
];

const STATUS_ESTIMATES: Record<PipelineStatus, number> = {
  PARSING: 5,
  SCRIPTING: 20,
  GENERATING_IMAGES: 15,
  GENERATING_VIDEO: 45,
  GENERATING_AUDIO: 20,
  REVIEW: 0,
  APPROVED: 0,
  PUBLISHING: 90,
  PUBLISHED: 0,
  FAILED: 0,
};

export function getNextStatus(current: PipelineStatus): PipelineStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export function getEstimatedRemaining(status: PipelineStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx === -1) return 0;
  return STATUS_ORDER.slice(idx).reduce((sum, s) => sum + (STATUS_ESTIMATES[s] ?? 0), 0);
}

export function getStageIndex(status: PipelineStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export function getTotalStages(): number {
  return STATUS_ORDER.length;
}

export { STATUS_ORDER };
