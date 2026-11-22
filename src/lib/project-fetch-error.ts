import { packFailureReasonLabel } from "@/lib/generate/pack-summary";

interface ProjectErrorSource {
  status: string;
  errorMessage?: string | null;
  tasks?: Array<{ status: string; errorMessage?: string | null }>;
}

/**
 * Banner copy for a freshly fetched project.
 * A current FAILED status keeps the task or project error.
 * Any other status, including GENERATED after a later success, clears it.
 * The stored code is labeled for display. The database value is unchanged.
 */
export function projectGenerationError(
  project: ProjectErrorSource | null | undefined,
  generateFailedLabel: string,
  locale?: string,
): string {
  if (!project || project.status !== "FAILED") return "";
  const failedTask = (project.tasks ?? []).find(
    (task) => task.status === "FAILED" && task.errorMessage
  );
  const detail = project.errorMessage || failedTask?.errorMessage || "";
  const shown = detail ? packFailureReasonLabel(detail, locale) : "";
  return shown ? `${generateFailedLabel}: ${shown}` : generateFailedLabel;
}
