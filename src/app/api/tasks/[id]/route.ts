import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { uploadBuffer, hasS3Config } from "@/lib/s3";
import { fetchImageBuffer } from "@/lib/overlay-logo";
import { ASYNC_ENGINES } from "@/lib/ai/constants";
import { releaseGeneratingProject } from "@/lib/project-status";
import { refundGenerationDebit } from "@/lib/creem/credits-runtime";

// Simple in-memory lock to avoid duplicate Gemini calls per task
const processingLocks = new Set<string>();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      project: { select: { userId: true } },
      promptTemplate: { select: { name: true, nameZh: true } },
    },
  });

  if (!task || task.project.userId !== session.user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // ── Trigger Gemini generation on first poll ──
  if (
    task.status === "PENDING" &&
    ASYNC_ENGINES.has(task.engineType) &&
    !processingLocks.has(id)
  ) {
    processingLocks.add(id);

    let handoffDebit: { accountId?: string; transactionId?: string } | null = null;
    try {
      const params = JSON.parse(task.errorMessage || "{}") as {
        prompt?: string;
        sharedImageUrl?: string;
        genWidth?: number;
        genHeight?: number;
        creemDebit?: { accountId?: string; transactionId?: string } | null;
      };
      handoffDebit = params.creemDebit ?? null;
      const provider = getProvider(task.engineType);

      await db.task.update({
        where: { id },
        data: { status: "PROCESSING", errorMessage: null },
      });

      const result = await provider.createPrediction({
        prompt: params.prompt || "",
        productImageUrl: params.sharedImageUrl || "",
        numOutputs: 1,
        width: params.genWidth || 1024,
        height: params.genHeight || 1024,
      });

      const outputs = result.outputs;
      if (outputs?.[0]?.url) {
        const imgUrl = outputs[0].url;
        const isDataUrl = imgUrl.startsWith("data:");
        let finalUrl = imgUrl;
        let finalKey = imgUrl;

        if (hasS3Config()) {
          try {
            // fetchImageBuffer handles both http(s) URLs and data: URLs (Node undici supports data: scheme)
            const imageBuf = await fetchImageBuffer(imgUrl);
            const r2 = await uploadBuffer(imageBuf, "image/png", "generated/");
            finalUrl = r2.publicUrl;
            finalKey = r2.s3Key;
          } catch { /* keep provider URL */ }
        } else if (isDataUrl) {
          // Gemini/gpt-image return base64 data URLs. Without R2 configured there is nowhere to
          // persist them — a multi-hundred-KB data URL must NOT be written into the DB url/s3Key
          // columns. Fail loudly so the operator knows to configure S3/R2.
          throw new Error(
            "Image engine returned a base64 data URL but S3/R2 is not configured. " +
              "Set R2/S3 env vars to persist generated images."
          );
        }

        await db.generatedImage.create({
          data: {
            imageProjectId: task.imageProjectId,
            productImageId: task.productImageId,
            s3Key: finalKey, url: finalUrl, promptUsed: params.prompt || "",
            aiProvider: task.engineType, status: "SUCCEEDED", completedAt: new Date(),
          },
        });

        await db.task.update({
          where: { id },
          data: { status: "SUCCEEDED", resultUrl: finalUrl, errorMessage: null },
        });

        await db.imageProject.update({
          where: { id: task.imageProjectId },
          data: { status: "GENERATED" },
        });
      } else {
        if (handoffDebit?.accountId && handoffDebit.transactionId) {
          await refundGenerationDebit({
            accountId: handoffDebit.accountId,
            transactionId: handoffDebit.transactionId,
          });
        }
        await db.task.update({
          where: { id },
          data: { status: "FAILED", errorMessage: "No output from provider" },
        });
      }
    } catch (err) {
      if (handoffDebit?.accountId && handoffDebit.transactionId) {
        await refundGenerationDebit({
          accountId: handoffDebit.accountId,
          transactionId: handoffDebit.transactionId,
        });
      }
      await db.task.update({
        where: { id },
        data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown error" },
      });
    } finally {
      processingLocks.delete(id);
    }
  }

  // ── Re-fetch updated task ──
  const updatedTask = await db.task.findUnique({
    where: { id },
    select: {
      id: true, status: true, predictionId: true, errorMessage: true,
      engineType: true, resultUrl: true, createdAt: true,
    },
  });

  if (!updatedTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // A failed task (including "no output") must not leave the project GENERATING.
  // Polling this route is what the project page does, so settle here.
  if (updatedTask.status === "FAILED") {
    await releaseGeneratingProject(task.imageProjectId, updatedTask.errorMessage);
  }

  // Find generated image result
  let result: { id: string; url: string; status: string } | null = null;

  if (updatedTask.status === "SUCCEEDED") {
    const genImage = await db.generatedImage.findFirst({
      where: {
        imageProjectId: task.imageProjectId,
        productImageId: task.productImageId,
        status: "SUCCEEDED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, status: true },
    });
    if (genImage) result = genImage;
  } else if (updatedTask.predictionId) {
    const genImage = await db.generatedImage.findFirst({
      where: { webhookId: updatedTask.predictionId },
      select: { id: true, url: true, status: true },
    });
    if (genImage) result = genImage;
  }

  return NextResponse.json({
    task: {
      id: updatedTask.id,
      status: updatedTask.status,
      predictionId: updatedTask.predictionId,
      errorMessage:
        updatedTask.status === "FAILED" && !updatedTask.errorMessage?.trim().startsWith("{")
          ? updatedTask.errorMessage
          : null,
      promptTemplate: task.promptTemplate
        ? task.promptTemplate.nameZh || task.promptTemplate.name
        : null,
      createdAt: updatedTask.createdAt,
    },
    result: result
      ? { id: result.id, url: result.status === "SUCCEEDED" ? result.url : null, status: result.status }
      : null,
    poll: updatedTask.status === "PENDING" || updatedTask.status === "PROCESSING",
    nextPollMs: updatedTask.status === "PROCESSING" ? 3000 : 2000,
  });
}
