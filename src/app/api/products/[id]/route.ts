import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedGetUrl } from "@/lib/s3";

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
      tasks: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          promptTemplate: { select: { name: true, nameZh: true } },
        },
      },
    },
  });

  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Resolve presigned GET URLs for private R2 objects
  function isR2Key(key: string | null): boolean {
    return !!(key && (key.startsWith("products/") || key.startsWith("generated/")));
  }

  const resolvedProductImages = await Promise.all(
    project.productImages.map(async (img) => ({
      ...img,
      originalUrl: isR2Key(img.s3Key)
        ? await getSignedGetUrl(img.s3Key).catch(() => img.originalUrl)
        : img.originalUrl,
    }))
  );

  const resolvedGeneratedImages = await Promise.all(
    project.generatedImages.map(async (img) => ({
      ...img,
      url: isR2Key(img.s3Key)
        ? await getSignedGetUrl(img.s3Key).catch(() => img.url)
        : img.url,
    }))
  );

  return NextResponse.json({
    project: {
      ...project,
      productImages: resolvedProductImages,
      generatedImages: resolvedGeneratedImages,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await db.imageProject.findUnique({ where: { id } });
  if (!project || project.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  await db.imageProject.update({ where: { id }, data: { title: body.title } });
  return NextResponse.json({ updated: true });
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
