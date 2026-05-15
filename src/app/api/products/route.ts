import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, promptTemplateId } = await req.json();

  const project = await db.imageProject.create({
    data: {
      userId: session.user.id,
      title: title ?? "",
      promptTemplateId: promptTemplateId ?? null,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
