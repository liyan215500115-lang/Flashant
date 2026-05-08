import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEstimatedRemaining } from "@/lib/pipeline";
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

  const { productUrl } = await request.json();
  if (!productUrl) {
    return Response.json({ error: "productUrl is required" }, { status: 400 });
  }

  const project = await db.videoProject.create({
    data: {
      userId: session.user.id,
      productUrl,
      status: "PARSING",
      stageProgress: 0,
      estimatedRemaining: getEstimatedRemaining("PARSING"),
    },
  });

  return Response.json(project, { status: 201 });
}
