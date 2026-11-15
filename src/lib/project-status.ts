import { db } from "@/lib/db";

/**
 * Leave GENERATING once nothing is still in flight.
 * A failed task, or a run that produced no output, must not pin the project
 * on GENERATING. If any image succeeded, the project is GENERATED; otherwise FAILED.
 * No-ops while another task is PENDING or PROCESSING, and when the project
 * is already past GENERATING.
 */
export async function releaseGeneratingProject(
  imageProjectId: string,
  errorMessage?: string | null
) {
  const inFlight = await db.task.count({
    where: { imageProjectId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (inFlight > 0) return;

  const project = await db.imageProject.findUnique({
    where: { id: imageProjectId },
    select: { status: true },
  });
  if (!project || project.status !== "GENERATING") return;

  const succeeded = await db.generatedImage.count({
    where: { imageProjectId, status: "SUCCEEDED" },
  });

  if (succeeded > 0) {
    await db.imageProject.update({
      where: { id: imageProjectId },
      data: { status: "GENERATED", errorMessage: null },
    });
    return;
  }

  await db.imageProject.update({
    where: { id: imageProjectId },
    data: {
      status: "FAILED",
      ...(errorMessage ? { errorMessage } : {}),
    },
  });
}
