import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateImage } from "@/lib/ai/validator";
import { uploadBuffer, saveBufferLocally, hasS3Config } from "@/lib/s3";

export async function POST(req: Request) {
  const body = await req.json();

  const predictionId = body.id;
  const status = body.status;

  if (!predictionId) {
    return NextResponse.json({ error: "Missing prediction ID" }, { status: 400 });
  }

  // Find the generated image record by webhook ID
  const genImage = await db.generatedImage.findFirst({
    where: { webhookId: predictionId },
    include: { project: true },
  });

  if (!genImage) {
    // Prediction not associated with any project — ignore
    return NextResponse.json({ received: true });
  }

  // Sync task status if a task exists for this prediction
  const task = await db.task.findFirst({
    where: { predictionId },
  });

  if (status === "succeeded") {
    const outputs: string[] = body.output as string[];

    if (!outputs || outputs.length === 0) {
      await db.generatedImage.update({
        where: { id: genImage.id },
        data: {
          status: "FAILED",
          errorMessage: "No outputs from Replicate",
        },
      });
      if (task) {
        await db.task.update({
          where: { id: task.id },
          data: { status: "FAILED", errorMessage: "No outputs from Replicate" },
        });
      }
      return NextResponse.json({ received: true });
    }

    // Validate first output before accepting
    try {
      const headRes = await fetch(outputs[0], { method: "HEAD" });
      const fileSize = parseInt(headRes.headers.get("content-length") ?? "0");
      const mimeType = headRes.headers.get("content-type") ?? "image/png";

      const validation = validateImage({
        fileSize,
        mimeType,
        width: 1024,
        height: 1024,
      });

      if (!validation.valid) {
        // Don't deduct quota for invalid results
        await db.generatedImage.update({
          where: { id: genImage.id },
          data: {
            status: "FAILED",
            errorMessage: `Validation failed: ${validation.reason}`,
          },
        });
        return NextResponse.json({ received: true });
      }
    } catch {
      // Can't validate — accept the result but log it
      console.warn(`Could not validate generated image ${genImage.id}`);
    }

    // Download from Replicate and re-upload to R2 for persistent storage
    const replicateUrl = outputs[0];
    let imageUrl: string;
    let imageKey: string;

    try {
      const imageRes = await fetch(replicateUrl);
      if (!imageRes.ok) throw new Error(`Download failed: ${imageRes.status}`);
      const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
      const imageType = imageRes.headers.get("content-type") ?? "image/png";

      if (hasS3Config()) {
        const uploaded = await uploadBuffer(imageBuffer, imageType, "generated/");
        imageKey = uploaded.s3Key;
        imageUrl = uploaded.publicUrl;
      } else {
        // Dev fallback: save locally
        const saved = await saveBufferLocally(imageBuffer, imageType);
        imageKey = saved.s3Key;
        imageUrl = saved.publicUrl;
      }
    } catch (e) {
      console.error("Failed to persist generated image:", e);
      // Fall back to Replicate URL if upload fails
      imageUrl = replicateUrl;
      imageKey = replicateUrl;
    }

    await db.generatedImage.update({
      where: { id: genImage.id },
      data: {
        url: imageUrl,
        s3Key: imageKey,
        status: "SUCCEEDED",
        completedAt: new Date(),
      },
    });

    // If all generations for this project are done, update project status
    const pendingCount = await db.generatedImage.count({
      where: {
        imageProjectId: genImage.imageProjectId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (pendingCount === 0) {
      await db.imageProject.update({
        where: { id: genImage.imageProjectId },
        data: { status: "GENERATED" },
      });
    }
  } else if (status === "failed") {
    await db.generatedImage.update({
      where: { id: genImage.id },
      data: {
        status: "FAILED",
        errorMessage: body.error ?? "Replicate prediction failed",
      },
    });
  }

  return NextResponse.json({ received: true });
}
