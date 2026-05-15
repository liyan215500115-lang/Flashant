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

  const project = await db.imageProject.findUnique({
    where: { id },
    include: {
      productImages: { orderBy: { sortOrder: "asc" } },
      generatedImages: { orderBy: { createdAt: "desc" } },
      promptTemplate: { select: { id: true, name: true, nameZh: true, category: true } },
      publishRecords: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.imageProject.findUnique({ where: { id } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await db.imageProject.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
