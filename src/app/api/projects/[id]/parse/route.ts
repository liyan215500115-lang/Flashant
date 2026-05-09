import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceProject, failProject } from "@/lib/pipeline-db";
import { claudeProvider } from "@/lib/ai";
import type { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
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

  if (project.status !== "PARSING") {
    return Response.json({ error: "Project is not in PARSING state" }, { status: 400 });
  }

  try {
    if (!project.productImage) {
      throw new Error("没有商品图片可供分析");
    }

    // Build absolute URL for the image so Claude Vision can access it
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const imageUrl = project.productImage.startsWith("http")
      ? project.productImage
      : `${baseUrl}${project.productImage}`;

    const analysis = await claudeProvider.analyzeImage(
      imageUrl,
      project.productTitle || undefined,
    );

    await db.videoProject.update({
      where: { id },
      data: {
        productTitle: analysis.name,
        productImage: project.productImage,
        script: {
          productAnalysis: analysis,
        } as unknown as object,
      },
    });

    await advanceProject(id, "SCRIPTING");

    const updated = await db.videoProject.findUnique({
      where: { id },
      include: { mediaAssets: true },
    });

    return Response.json(updated);
  } catch (e) {
    await failProject(id, `图片分析失败: ${e instanceof Error ? e.message : "未知错误"}`);
    return Response.json({ error: "Parse failed" }, { status: 500 });
  }
}
