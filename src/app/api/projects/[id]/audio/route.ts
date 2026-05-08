import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceProject, failProject } from "@/lib/pipeline-db";
import { ttsProvider } from "@/lib/ai";
import type { ScriptGenerationResult } from "@/lib/ai/types";
import type { NextRequest } from "next/server";

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

  if (project.status !== "GENERATING_AUDIO") {
    return Response.json({ error: "Project is not in GENERATING_AUDIO state" }, { status: 400 });
  }

  const script = project.script as unknown as ScriptGenerationResult | null;
  if (!script?.voiceover) {
    await failProject(id, "没有配音文本");
    return Response.json({ error: "No voiceover text" }, { status: 400 });
  }

  try {
    const result = await ttsProvider.generate(script.voiceover);

    const asset = await db.mediaAsset.create({
      data: {
        videoProjectId: id,
        type: "AUDIO",
        url: result.url,
        stageIndex: 0,
        aiProvider: result.provider,
      },
    });

    await advanceProject(id, "REVIEW");
    const updated = await db.videoProject.findUnique({
      where: { id },
      include: { mediaAssets: true },
    });

    return Response.json(updated);
  } catch (e) {
    await failProject(id, `语音合成失败: ${e instanceof Error ? e.message : "未知错误"}`);
    return Response.json({ error: "TTS failed" }, { status: 500 });
  }
}
