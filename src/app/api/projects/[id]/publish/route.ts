import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceProject, failProject } from "@/lib/pipeline-db";
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
  const { platforms } = await _req.json().catch(() => ({ platforms: [] }));

  const project = await db.videoProject.findUnique({
    where: { id },
    include: { mediaAssets: true },
  });

  if (!project || project.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (project.status !== "REVIEW" && project.status !== "APPROVED") {
    return Response.json({ error: "Project is not ready for publishing" }, { status: 400 });
  }

  try {
    const publishTargets = platforms.length > 0 ? platforms : ["douyin", "kuaishou"];

    const records = [];
    for (const platform of publishTargets) {
      const record = await db.publishRecord.create({
        data: {
          videoProjectId: id,
          platform,
          status: "QUEUED",
        },
      });
      records.push(record);
    }

    await advanceProject(id, "PUBLISHING");

    const updated = await db.videoProject.findUnique({
      where: { id },
      include: { mediaAssets: true, publishRecords: true },
    });

    return Response.json(updated);
  } catch (e) {
    await failProject(id, `发布失败: ${e instanceof Error ? e.message : "未知错误"}`);
    return Response.json({ error: "Publish failed" }, { status: 500 });
  }
}
