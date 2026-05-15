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

  const { imageProjectId, productImageId, promptTemplateId } =
    await req.json();

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

  // Double-click guard: check for existing in-progress task
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

  // Get prompt
  let prompt = "Professional product photography, studio lighting, high quality";
  if (promptTemplateId) {
    const template = await db.promptTemplate.findUnique({
      where: { id: promptTemplateId },
    });
    if (template) prompt = template.prompt;
  }

  // Step 1: Create Task with PENDING status
  const task = await db.task.create({
    data: {
      imageProjectId,
      productImageId,
      promptTemplateId: promptTemplateId ?? null,
      status: "PENDING",
    },
  });

  // Update project to GENERATING
  await db.imageProject.update({
    where: { id: imageProjectId },
    data: { status: "GENERATING" },
  });

  // Step 2: Fire Replicate prediction (async — don't await result)
  const provider = getProvider("replicate");
  provider
    .createPrediction({
      prompt,
      productImageUrl: productImage.originalUrl,
      numOutputs: 2,
    })
    .then(async (result) => {
      // Update task with prediction ID → PROCESSING
      await db.task.update({
        where: { id: task.id },
        data: {
          predictionId: result.predictionId,
          status: "PROCESSING",
        },
      });

      // Also create a GeneratedImage placeholder for the webhook path
      await db.generatedImage.create({
        data: {
          imageProjectId,
          productImageId,
          s3Key: "pending",
          url: "",
          promptUsed: prompt,
          aiProvider: "replicate",
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

  // Step 3: Return task immediately — don't wait for Replicate
  return NextResponse.json({
    taskId: task.id,
    status: "pending",
    message: "任务已创建，请通过 /api/tasks/[id] 查询进度",
  });
}
