import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function GET(
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
    include: { mediaAssets: true, publishRecords: true },
  });

  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (project.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.videoProject.findUnique({ where: { id } });

  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (project.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.videoProject.delete({ where: { id } });
  return Response.json({ success: true });
}
