import { db } from "@/lib/db";
import { STATUS_ORDER, getEstimatedRemaining } from "@/lib/pipeline";
import type { PipelineStatus } from "@prisma/client";

export async function advanceProject(projectId: string, nextStatus: PipelineStatus) {
  return db.videoProject.update({
    where: { id: projectId },
    data: {
      status: nextStatus,
      stageProgress: Math.round((STATUS_ORDER.indexOf(nextStatus) / (STATUS_ORDER.length - 1)) * 100),
      estimatedRemaining: getEstimatedRemaining(nextStatus),
    },
  });
}

export async function failProject(projectId: string, errorMessage: string) {
  return db.videoProject.update({
    where: { id: projectId },
    data: { status: "FAILED", errorMessage },
  });
}
