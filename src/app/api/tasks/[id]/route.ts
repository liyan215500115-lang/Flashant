import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  // Also check if there's a GeneratedImage result for this task
  let result: {
    id: string;
    url: string;
    status: string;
  } | null = null;

  if (task.predictionId) {
    const genImage = await db.generatedImage.findFirst({
      where: { webhookId: task.predictionId },
      select: { id: true, url: true, status: true },
    });
    if (genImage) {
      result = genImage;
    }
  }

  return NextResponse.json({
    task: {
      id: task.id,
      status: task.status,
      predictionId: task.predictionId,
      errorMessage: task.errorMessage,
      promptTemplate: task.promptTemplate
        ? task.promptTemplate.nameZh || task.promptTemplate.name
        : null,
      createdAt: task.createdAt,
    },
    result: result
      ? {
          id: result.id,
          url: result.status === "SUCCEEDED" ? result.url : null,
          status: result.status,
        }
      : null,
    // Frontend polling hint
    poll: task.status === "PENDING" || task.status === "PROCESSING",
    nextPollMs: task.status === "PENDING" ? 2000 : 5000,
  });
}
