import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceProject, failProject } from "@/lib/pipeline-db";
import { videoProvider } from "@/lib/ai";
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
  const project = await db.videoProject.findUnique({
    where: { id },
    include: { mediaAssets: { where: { type: "IMAGE" }, orderBy: { stageIndex: "asc" } } },
  });

  if (!project || project.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (project.status !== "GENERATING_VIDEO") {
    return Response.json({ error: "Project is not in GENERATING_VIDEO state" }, { status: 400 });
  }

  const script = project.script as unknown as ScriptGenerationResult | null;
  const images = project.mediaAssets;

  if (!script?.scenes?.length || images.length === 0) {
    await failProject(id, "没有图片资源");
    return Response.json({ error: "No images to convert" }, { status: 400 });
  }

  try {
    const assets: { id: string; url: string; stageIndex: number }[] = [];

    for (const scene of script.scenes) {
      const img = images.find((i) => i.stageIndex === scene.index);
      const startImageUrl = img?.url ?? images[0]?.url ?? "";

      const result = await videoProvider.generate(
        scene.videoPrompt,
        startImageUrl,
      );

      const asset = await db.mediaAsset.create({
        data: {
          videoProjectId: id,
          type: "VIDEO",
          url: result.url,
          stageIndex: scene.index,
          aiProvider: result.provider,
          generationMeta: result.metadata as object,
        },
      });

      assets.push({ id: asset.id, url: result.url, stageIndex: scene.index });
    }

    await advanceProject(id, "GENERATING_AUDIO");
    const updated = await db.videoProject.findUnique({
      where: { id },
      include: { mediaAssets: true },
    });

    return Response.json(updated);
  } catch (e) {
    await failProject(id, `视频生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
    return Response.json({ error: "Video generation failed" }, { status: 500 });
  }
}
