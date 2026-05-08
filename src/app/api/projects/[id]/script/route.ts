import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceProject, failProject } from "@/lib/pipeline-db";
import { claudeProvider } from "@/lib/ai";
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

  if (project.status !== "SCRIPTING") {
    return Response.json({ error: "Project is not in SCRIPTING state" }, { status: 400 });
  }

  try {
    const script = await claudeProvider.generate(
      project.productTitle,
      project.productImage || "未提供图片",
      project.productImage || undefined,
    );

    const updated = await db.videoProject.update({
      where: { id },
      data: { script: script as unknown as object },
    });

    await advanceProject(id, "GENERATING_IMAGES");
    return Response.json({ ...updated, script });
  } catch (e) {
    await failProject(id, `脚本生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
    return Response.json({ error: "Script generation failed" }, { status: 500 });
  }
}
