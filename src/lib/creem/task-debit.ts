import "server-only";

import { readCreemDebit } from "@/lib/creem/credits";
import { refundGenerationDebit } from "@/lib/creem/credits-runtime";
import { db } from "@/lib/db";

/**
 * Reverse a task's generation debit from Task.generationMeta.
 * Does not read errorMessage. Safe to call after that column has been cleared.
 */
export async function reverseStoredTaskDebit(taskId: string): Promise<{ reversed: boolean }> {
  const row = await db.task.findUnique({
    where: { id: taskId },
    select: { generationMeta: true },
  });
  const debit = readCreemDebit(row?.generationMeta);
  if (!debit) return { reversed: false };
  return refundGenerationDebit(debit);
}
