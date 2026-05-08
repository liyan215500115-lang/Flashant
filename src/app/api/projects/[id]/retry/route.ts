import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { NextRequest } from "next/server";

const FAILED_STAGE_MAP: Record<string, string> = {
  PARSING: "parse",
  SCRIPTING: "script",
  GENERATING_IMAGES: "images",
  GENERATING_VIDEO: "video",
  GENERATING_AUDIO: "audio",
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.videoProject.findUnique({ where: { id } });

  if (!project || project.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (project.status !== "FAILED") {
    return Response.json({ error: "Project is not in FAILED state" }, { status: 400 });
  }

  const retryStage = FAILED_STAGE_MAP[project.errorMessage?.includes("解析") ? "PARSING" :
    project.errorMessage?.includes("脚本") ? "SCRIPTING" :
    project.errorMessage?.includes("图片") ? "GENERATING_IMAGES" :
    project.errorMessage?.includes("视频") ? "GENERATING_VIDEO" :
    project.errorMessage?.includes("配音") || project.errorMessage?.includes("语音") ? "GENERATING_AUDIO" :
    "SCRIPTING"] || "parse";

  await db.videoProject.update({
    where: { id },
    data: { status: "SCRIPTING", errorMessage: null },
  });

  return Response.json({ stage: retryStage, projectId: id });
}
