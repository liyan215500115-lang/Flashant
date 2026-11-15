import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await db.imageProject.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.s3Key !== "string" || !body.s3Key || typeof body.url !== "string" || !body.url) {
    return NextResponse.json({ error: "s3Key and url are required" }, { status: 400 });
  }

  let productImageId: string | null = null;
  if (typeof body.productImageId === "string" && body.productImageId) {
    const owned = await db.productImage.findFirst({
      where: { id: body.productImageId, imageProjectId: projectId },
    });
    if (!owned) {
      return NextResponse.json({ error: "Product image not found" }, { status: 400 });
    }
    productImageId = owned.id;
  }

  const generatedImage = await db.generatedImage.create({
    data: {
      imageProjectId: projectId,
      productImageId,
      s3Key: body.s3Key,
      url: body.url,
      promptUsed: typeof body.promptUsed === "string" ? body.promptUsed.slice(0, 500) : "manual-edit",
      aiProvider: "manual",
      fileSize: typeof body.fileSize === "number" ? body.fileSize : null,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : "image/png",
      status: "SUCCEEDED",
      completedAt: new Date(),
      generationMeta: { source: "manual" },
    },
  });

  return NextResponse.json({ generatedImage }, { status: 201 });
}
