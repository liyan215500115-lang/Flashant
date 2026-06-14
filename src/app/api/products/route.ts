import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { serverT } from "@/lib/server-t";
import { getSignedGetUrl } from "@/lib/s3";

function isR2Key(key: string | null): boolean {
  return !!(key && (key.startsWith("products/") || key.startsWith("generated/")));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await db.imageProject.findMany({
    where: { userId: session.user.id },
    include: {
      productImages: { take: 1, orderBy: { sortOrder: "asc" } },
      generatedImages: {
        where: { status: "SUCCEEDED" },
        take: 1,
      },
      promptTemplate: { select: { name: true, nameZh: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Resolve presigned GET URLs for private R2 images
  const resolved = await Promise.all(
    projects.map(async (p) => ({
      ...p,
      productImages: await Promise.all(
        p.productImages.map(async (img) => ({
          ...img,
          originalUrl: isR2Key(img.s3Key)
            ? await getSignedGetUrl(img.s3Key!)
            : img.originalUrl,
        }))
      ),
      generatedImages: await Promise.all(
        p.generatedImages.map(async (img) => ({
          ...img,
          url: isR2Key(img.s3Key)
            ? await getSignedGetUrl(img.s3Key!)
            : img.url,
        }))
      ),
    }))
  );

  return NextResponse.json({ projects: resolved });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title = "";
  let promptTemplateId: string | null = null;
  let imageUrl: string | null = null;
  let s3Key: string | null = null;
  let fileName = "product.png";
  let fileSize = 0;
  let mimeType = "image/png";

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // Legacy: direct upload via server (dev fallback)
    const formData = await req.formData();
    title = (formData.get("title") as string) ?? "";
    promptTemplateId = formData.get("promptTemplateId") as string | null;

    const imageFile = formData.get("image") as File | null;
    if (imageFile) {
      fileName = imageFile.name;
      fileSize = imageFile.size;
      mimeType = imageFile.type || "image/png";

      const ext = path.extname(fileName) || ".png";
      const uniqueName = `${crypto.randomUUID()}${ext}`;
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, uniqueName), buffer);
      imageUrl = `/uploads/${uniqueName}`;
      s3Key = imageUrl;
    }
  } else {
    // S3 pre-signed upload path (production)
    const body = await req.json();
    title = body.title ?? "";
    promptTemplateId = body.promptTemplateId ?? null;
    fileName = body.fileName ?? "product.png";
    fileSize = body.fileSize ?? 0;
    mimeType = body.mimeType ?? "image/png";
    s3Key = body.s3Key ?? null;
    imageUrl = body.originalUrl ?? s3Key ?? null;
  }

  const project = await db.imageProject.create({
    data: {
      userId: session.user.id,
      title: title || `${new Date().toLocaleDateString("zh-CN")} ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      promptTemplateId: promptTemplateId ?? null,
      status: "DRAFT",
    },
  });

  if (imageUrl) {
    await db.productImage.create({
      data: {
        imageProjectId: project.id,
        originalUrl: imageUrl,
        s3Key: s3Key ?? imageUrl,
        fileName,
        fileSize,
        mimeType,
        sortOrder: 0,
      },
    });
  }

  return NextResponse.json({ project }, { status: 201 });
}
