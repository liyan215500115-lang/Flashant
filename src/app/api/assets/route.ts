import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const images = await db.generatedImage.findMany({
    where: {
      project: { userId: session.user.id },
      status: "SUCCEEDED",
    },
    include: {
      project: { select: { title: true, targetPlatform: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ images });
}
