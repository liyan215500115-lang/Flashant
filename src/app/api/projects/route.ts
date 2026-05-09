import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEstimatedRemaining } from "@/lib/pipeline";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await db.videoProject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(projects);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const imageFile = formData.get("image") as File | null;
  const hint = (formData.get("hint") as string) || "";

  if (!imageFile) {
    return Response.json({ error: "image is required" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const ext = imageFile.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filepath = path.join(uploadsDir, filename);

  const buffer = Buffer.from(await imageFile.arrayBuffer());
  await writeFile(filepath, buffer);

  const imageUrl = `/uploads/${filename}`;

  const project = await db.videoProject.create({
    data: {
      userId: session.user.id,
      productUrl: "",
      productTitle: hint || "未命名商品",
      productImage: imageUrl,
      status: "PARSING",
      stageProgress: 0,
      estimatedRemaining: getEstimatedRemaining("PARSING"),
    },
  });

  return Response.json(project, { status: 201 });
}
