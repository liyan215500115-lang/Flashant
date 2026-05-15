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

  // Quota check
  const quota = await checkGenerationQuota(userId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        message: `Generation limit reached (${quota.used}/${quota.limit}). Upgrade to continue.`,
        tier: quota.tier,
      },
      { status: 402 }
    );
  }

  const { imageProjectId, productImageId, promptTemplateId } =
    await req.json();

  if (!imageProjectId || !productImageId) {
    return NextResponse.json(
      { error: "imageProjectId and productImageId are required" },
      { status: 400 }
    );
  }

  // Check project ownership
  const project = await db.imageProject.findUnique({
    where: { id: imageProjectId },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Prevent double-click: check if already generating
  const existingGeneration = await db.generatedImage.findFirst({
    where: {
      imageProjectId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (existingGeneration) {
    return NextResponse.json(
      { error: "already_generating", message: "Generation already in progress" },
      { status: 409 }
    );
  }

  // Get product image URL
  const productImage = await db.productImage.findUnique({
    where: { id: productImageId },
  });

  if (!productImage) {
    return NextResponse.json(
      { error: "Product image not found" },
      { status: 404 }
    );
  }

  // Get prompt template if specified
  let prompt =
    "Professional product photography, studio lighting, high quality";
  if (promptTemplateId) {
    const template = await db.promptTemplate.findUnique({
      where: { id: promptTemplateId },
    });
    if (template) {
      prompt = template.prompt;
    }
  }

  // Create placeholder generation records (skeleton)
  const placeholder = await db.generatedImage.create({
    data: {
      imageProjectId,
      productImageId,
      s3Key: "pending",
      url: "",
      promptUsed: prompt,
      aiProvider: "replicate",
      status: "PROCESSING",
    },
  });

  // Fire-and-forget: start Replicate prediction
  try {
    const provider = getProvider("replicate");
    const result = await provider.createPrediction({
      prompt,
      productImageUrl: productImage.originalUrl,
      numOutputs: 2,
    });

    // Update with webhook/prediction ID
    await db.generatedImage.update({
      where: { id: placeholder.id },
      data: { webhookId: result.predictionId },
    });

    // Update project status
    await db.imageProject.update({
      where: { id: imageProjectId },
      data: { status: "GENERATING" },
    });

    return NextResponse.json({
      generationId: placeholder.id,
      predictionId: result.predictionId,
      status: "processing",
    });
  } catch (error) {
    // Mark as failed
    await db.generatedImage.update({
      where: { id: placeholder.id },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      {
        error: "generation_failed",
        message:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
