import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceProject, failProject } from "@/lib/pipeline-db";
import { imageProvider } from "@/lib/ai";
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

  if (project.status !== "GENERATING_IMAGES") {
    return Response.json({ error: "Project is not in GENERATING_IMAGES state" }, { status: 400 });
  }

  const script = project.script as unknown as ScriptGenerationResult | null;
  if (!script?.scenes?.length) {
    await failProject(id, "没有分镜脚本");
    return Response.json({ error: "No script scenes" }, { status: 400 });
  }

  try {
    const assets: { id: string; url: string; stageIndex: number }[] = [];

    for (const scene of script.scenes) {
      const result = await imageProvider.generate(
        scene.imagePrompt,
        project.productImage || undefined,
      );

      const asset = await db.mediaAsset.create({
        data: {
          videoProjectId: id,
          type: "IMAGE",
          url: result.url,
          stageIndex: scene.index,
          aiProvider: result.provider,
          generationMeta: result.metadata as object,
        },
      });

      assets.push({ id: asset.id, url: result.url, stageIndex: scene.index });
    }

    await advanceProject(id, "GENERATING_VIDEO");
    const updated = await db.videoProject.findUnique({
      where: { id },
      include: { mediaAssets: true },
    });

    return Response.json(updated);
  } catch (e) {
    await failProject(id, `图片生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
    return Response.json({ error: "Image generation failed" }, { status: 500 });
  }
}
