import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedGetUrl } from "@/lib/s3";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const project = await db.imageProject.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { imageId } = await req.json();
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

  // Support deleting both product images and generated images
  const isProductImage = await db.productImage.findFirst({ where: { id: imageId, imageProjectId: projectId } });
  if (isProductImage) {
    await db.productImage.delete({ where: { id: imageId } });
    return NextResponse.json({ success: true });
  }

  const isGen = await db.generatedImage.findFirst({ where: { id: imageId, imageProjectId: projectId } });
  if (isGen) {
    await db.generatedImage.delete({ where: { id: imageId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Image not found" }, { status: 404 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  const project = await db.imageProject.findUnique({
    where: { id: projectId },
  });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { s3Key, originalUrl, fileName, fileSize, mimeType, width, height } =
    await req.json();

  if (!s3Key || !originalUrl || !fileName) {
    return NextResponse.json(
      { error: "s3Key, originalUrl, and fileName are required" },
      { status: 400 }
    );
  }

  const productImage = await db.productImage.create({
    data: {
      imageProjectId: projectId,
      s3Key,
      originalUrl,
      fileName,
      fileSize: fileSize ?? 0,
      mimeType: mimeType ?? "image/png",
      width: width ?? null,
      height: height ?? null,
      sortOrder: 0,
    },
  });

  // Resolve presigned GET URL for the private R2 image
  const resolvedUrl = s3Key.startsWith("products/") || s3Key.startsWith("generated/")
    ? await getSignedGetUrl(s3Key).catch(() => originalUrl)
    : originalUrl;

  return NextResponse.json({
    productImage: { ...productImage, originalUrl: resolvedUrl },
  }, { status: 201 });
}
