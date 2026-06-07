import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { checkGenerationQuota } from "@/lib/lemonsqueezy/billing";
import { serverT } from "@/lib/server-t";
import { getSignedGetUrl } from "@/lib/s3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { imageProjectId, productImageIds, prompt, numOutputs, engineType, promptTemplateId } = await req.json();
  if (!imageProjectId || !productImageIds?.length) {
    return NextResponse.json({ error: "imageProjectId and productImageIds required" }, { status: 400 });
  }

  const project = await db.imageProject.findUnique({ where: { id: imageProjectId } });
  if (!project || project.userId !== userId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const quota = await checkGenerationQuota(userId);
  if (!quota.allowed) {
    return NextResponse.json({ error: "quota_exceeded", message: `Quota: ${quota.used}/${quota.limit}`, tier: quota.tier }, { status: 402 });
  }

  const provider = getProvider(engineType || "flux");
  const results: Array<{ productImageId: string; taskId: string; status: string }> = [];

  for (const pid of productImageIds) {
    const productImage = await db.productImage.findUnique({ where: { id: pid } });
    if (!productImage) continue;

    const existing = await db.task.findFirst({
      where: { imageProjectId, productImageId: pid, status: { in: ["PENDING", "PROCESSING"] } },
    });
    if (existing) {
      results.push({ productImageId: pid, taskId: existing.id, status: "already_generating" });
      continue;
    }

    const sharedImageUrl = await getSignedGetUrl(productImage.s3Key, 3600).catch(() => productImage.originalUrl);

    const task = await db.task.create({
      data: { imageProjectId, productImageId: pid, promptTemplateId: promptTemplateId ?? null, engineType: engineType ?? "flux", status: "PENDING" },
    });

    // Fire async — don't await, let polling handle progress
    provider.createPrediction({ prompt: prompt || "Professional product photography", productImageUrl: sharedImageUrl, numOutputs: numOutputs ?? 1 })
      .then(async (pred) => {
        await db.task.update({ where: { id: task.id }, data: { predictionId: pred.predictionId, status: "PROCESSING" } });
        await db.generatedImage.create({ data: { imageProjectId, productImageId: pid, s3Key: "pending", url: "", promptUsed: prompt, aiProvider: engineType ?? "flux", status: "PROCESSING", webhookId: pred.predictionId } });
      })
      .catch(async () => {
        await db.task.update({ where: { id: task.id }, data: { status: "FAILED", errorMessage: "Prediction failed" } });
      });

    results.push({ productImageId: pid, taskId: task.id, status: "pending" });
  }

  await db.imageProject.update({ where: { id: imageProjectId }, data: { status: "GENERATING" } });

  return NextResponse.json({ results, message: `${results.length} tasks created` });
}
