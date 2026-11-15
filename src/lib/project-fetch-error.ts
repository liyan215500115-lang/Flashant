interface ProjectErrorSource {
  status: string;
  errorMessage?: string | null;
  tasks?: Array<{ status: string; errorMessage?: string | null }>;
}

/**
 * Banner copy for a freshly fetched project.
 * A current FAILED status keeps the task or project error.
 * Any other status, including GENERATED after a later success, clears it.
 */
export function projectGenerationError(
  project: ProjectErrorSource | null | undefined,
  generateFailedLabel: string
): string {
  if (!project || project.status !== "FAILED") return "";
  const failedTask = (project.tasks ?? []).find(
    (task) => task.status === "FAILED" && task.errorMessage
  );
  const detail = project.errorMessage || failedTask?.errorMessage || "";
  return detail ? `${generateFailedLabel}: ${detail}` : generateFailedLabel;
}
