/** Real pause between provider calls. Tests replace this so the suite does not wait. */
export async function packSleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
