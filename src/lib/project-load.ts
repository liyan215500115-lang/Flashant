/**
 * A transient project fetch must not replace a page that already has the project,
 * and must not flash a load error before the retries are done.
 */
export function shouldSurfaceProjectLoadError(input: {
  hasVisibleProject: boolean;
  failedAttempts: number;
  maxAttempts: number;
}): boolean {
  if (input.hasVisibleProject) return false;
  return input.failedAttempts >= input.maxAttempts;
}

export async function loadProjectWithRetry<T>(options: {
  fetchProject: () => Promise<T | null>;
  hasVisibleProject: () => boolean;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ ok: true; project: T } | { ok: false; keepVisible: boolean }> {
  const attempts = options.attempts ?? 3;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const project = await options.fetchProject();
      if (project) return { ok: true, project };
    } catch {
      // Retry. An empty body and a network error are the same transient failure.
    }
    if (shouldSurfaceProjectLoadError({
      hasVisibleProject: options.hasVisibleProject(),
      failedAttempts: attempt,
      maxAttempts: attempts,
    })) {
      return { ok: false, keepVisible: false };
    }
    if (attempt < attempts) await sleep(200 * attempt);
  }
  return { ok: false, keepVisible: options.hasVisibleProject() };
}
