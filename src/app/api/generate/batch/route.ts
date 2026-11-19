import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { releaseGeneratingProject } from "@/lib/project-status";
import { getSignedGetUrl } from "@/lib/s3";
import { chargeScreenedGeneration, refundGenerationDebit, type DebitHold } from "@/lib/creem/credits-runtime";
import { spendErrorResponse, withRefundFlag } from "@/lib/creem/http";
import {
  creemModerationMode,
  moderationHttpResponse,
  promptsForModeration,
  SCREEN_PLACEHOLDERS,
  screenGenerationPrompts,
} from "@/lib/creem/moderation";
import { sharedStaticPromptFragments } from "@/lib/creem/static-fragments";

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

  const outputsEach = typeof numOutputs === "number" && Number.isFinite(numOutputs) ? Math.ceil(numOutputs) : 1;
  const runnable: Array<{ productImageId: string; sharedImageUrl: string }> = [];
  const results: Array<{ productImageId: string; taskId: string; status: string }> = [];

  for (const pid of productImageIds as string[]) {
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
    runnable.push({ productImageId: pid, sharedImageUrl });
  }

  if (runnable.length === 0) {
    return NextResponse.json({ results, message: `${results.length} tasks created` });
  }

  const moderation = await screenGenerationPrompts({
    userId,
    prompts: promptsForModeration({ prompt }, sharedStaticPromptFragments()),
    placeholder: SCREEN_PLACEHOLDERS.generate,
    combine: true,
  });
  const blocked = moderationHttpResponse(moderation);
  if (blocked) return blocked;

  const generationId = crypto.randomUUID();
  const imageCount = runnable.length * Math.max(1, outputsEach);
  let hold: DebitHold | null = null;
  if (creemModerationMode() !== "off") {
    const charged = await chargeScreenedGeneration({
      userId,
      gate: moderation,
      imageCount,
      reference: `gen:${generationId}`,
      idempotencyKey: `debit:${generationId}`,
    });
    if (!charged.ok) return spendErrorResponse(charged);
    hold = charged.hold;
  }

  const provider = getProvider(engineType || "flux");
  const promptText = prompt || "Professional product photography";
  let started = 0;

  for (const item of runnable) {
    const task = await db.task.create({
      data: {
        imageProjectId,
        productImageId: item.productImageId,
        promptTemplateId: promptTemplateId ?? null,
        engineType: engineType ?? "flux",
        status: "PENDING",
      },
    });

    try {
      const pred = await provider.createPrediction({
        prompt: promptText,
        productImageUrl: item.sharedImageUrl,
        numOutputs: outputsEach,
      });
      await db.task.update({
        where: { id: task.id },
        data: { predictionId: pred.predictionId, status: "PROCESSING" },
      });
      await db.generatedImage.create({
        data: {
          imageProjectId,
          productImageId: item.productImageId,
          s3Key: "pending",
          url: "",
          promptUsed: promptText,
          aiProvider: engineType ?? "flux",
          status: "PROCESSING",
          webhookId: pred.predictionId,
          generationMeta: hold
            ? { creemDebit: { accountId: hold.accountId, transactionId: hold.transactionId } }
            : undefined,
        },
      });
      started += 1;
      results.push({ productImageId: item.productImageId, taskId: task.id, status: "pending" });
    } catch {
      await db.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: "Prediction failed" },
      });
      await releaseGeneratingProject(imageProjectId, "Prediction failed");
      results.push({ productImageId: item.productImageId, taskId: task.id, status: "failed" });
    }
  }

  if (started === 0) {
    const response = NextResponse.json(
      { error: "generation_failed", message: "All predictions failed", results },
      { status: 500 },
    );
    if (!hold) return response;
    const refund = await refundGenerationDebit(hold);
    return withRefundFlag(response, refund);
  }

  await db.imageProject.update({ where: { id: imageProjectId }, data: { status: "GENERATING" } });
  return NextResponse.json({ results, message: `${results.length} tasks created` });
}
