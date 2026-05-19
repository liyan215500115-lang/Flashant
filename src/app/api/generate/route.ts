import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/registry";
import { checkGenerationQuota } from "@/lib/stripe/billing";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const {
    imageProjectId,
    productImageId,
    promptTemplateId,
    prompt: customPrompt,
    numOutputs: customNumOutputs,
    engineType = "flux",
  } = await req.json();

  if (!imageProjectId || !productImageId) {
    return NextResponse.json(
      { error: "imageProjectId and productImageId are required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const project = await db.imageProject.findUnique({
    where: { id: imageProjectId },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Quota check
  const quota = await checkGenerationQuota(userId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        message: `额度已用完 (${quota.used}/${quota.limit})。请升级套餐继续使用。`,
        tier: quota.tier,
      },
      { status: 402 }
    );
  }

  // Double-click guard
  const existing = await db.task.findFirst({
    where: {
      imageProjectId,
      productImageId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "already_generating", taskId: existing.id },
      { status: 409 }
    );
  }

  // Get product image
  const productImage = await db.productImage.findUnique({
    where: { id: productImageId },
  });
  if (!productImage) {
    return NextResponse.json(
      { error: "Product image not found" },
      { status: 404 }
    );
  }

  // Prompt resolution
  let prompt = "Professional product photography, studio lighting, high quality";
  if (customPrompt) {
    prompt = customPrompt;
  } else if (promptTemplateId) {
    const template = await db.promptTemplate.findUnique({
      where: { id: promptTemplateId },
    });
    if (template) prompt = template.prompt;
  }

  const numOutputs = customNumOutputs ?? 2;

  // Resolve provider
  let provider;
  try {
    provider = getProvider(engineType);
  } catch {
    return NextResponse.json(
      { error: `AI engine "${engineType}" is not available` },
      { status: 400 }
    );
  }

  // Create task
  const task = await db.task.create({
    data: {
      imageProjectId,
      productImageId,
      promptTemplateId: promptTemplateId ?? null,
      engineType,
      status: "PENDING",
    },
  });

  // Update project to GENERATING
  await db.imageProject.update({
    where: { id: imageProjectId },
    data: { status: "GENERATING" },
  });

  if (engineType === "openai") {
    // ── OpenAI synchronous path ──
    try {
      const result = await provider.createPrediction({
        prompt,
        productImageUrl: productImage.originalUrl,
        numOutputs,
      });

      const openaiUrl = (result as { openaiUrl?: string }).openaiUrl;
      const imageUrl = openaiUrl ?? "";

      // Fetch the image to get file metadata
      let fileSize = 0;
      let mimeType = "image/png";
      try {
        const headRes = await fetch(imageUrl, { method: "HEAD" });
        fileSize = Number(headRes.headers.get("content-length") ?? 0);
        mimeType = headRes.headers.get("content-type") ?? "image/png";
      } catch {
        // Metadata fetch is best-effort
      }

      const generatedImage = await db.generatedImage.create({
        data: {
          imageProjectId,
          productImageId,
          s3Key: imageUrl,
          url: imageUrl,
          promptUsed: prompt,
          aiProvider: "openai",
          modelVersion: "gpt-image-2",
          fileSize,
          mimeType,
          width: 1024,
          height: 1024,
          status: "SUCCEEDED",
          completedAt: new Date(),
        },
      });

      await db.task.update({
        where: { id: task.id },
        data: { predictionId: result.predictionId, status: "SUCCEEDED", resultUrl: imageUrl },
      });

      // Check if all tasks for this project are done
      const pendingCount = await db.task.count({
        where: { imageProjectId, status: { in: ["PENDING", "PROCESSING"] } },
      });
      if (pendingCount === 0) {
        await db.imageProject.update({
          where: { id: imageProjectId },
          data: { status: "GENERATED" },
        });
      }

      return NextResponse.json({
        taskId: task.id,
        status: "succeeded",
        generatedImageId: generatedImage.id,
        url: imageUrl,
      });
    } catch (error) {
      await db.task.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
      await db.imageProject.update({
        where: { id: imageProjectId },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "generation_failed", message: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  // ── Flux (Replicate) async path ──
  provider
    .createPrediction({
      prompt,
      productImageUrl: productImage.originalUrl,
      numOutputs,
    })
    .then(async (result) => {
      await db.task.update({
        where: { id: task.id },
        data: {
          predictionId: result.predictionId,
          status: "PROCESSING",
        },
      });

      await db.generatedImage.create({
        data: {
          imageProjectId,
          productImageId,
          s3Key: "pending",
          url: "",
          promptUsed: prompt,
          aiProvider: engineType,
          status: "PROCESSING",
          webhookId: result.predictionId,
        },
      });
    })
    .catch(async (error) => {
      await db.task.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
      await db.imageProject.update({
        where: { id: imageProjectId },
        data: { status: "FAILED" },
      });
    });

  return NextResponse.json({
    taskId: task.id,
    status: "pending",
    engineType,
    message: "任务已创建，请通过 /api/tasks/[id] 查询进度",
  });
}
