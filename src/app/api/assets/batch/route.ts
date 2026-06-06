import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    // Verify ownership: all images must belong to the user's projects
    const images = await db.generatedImage.findMany({
      where: { id: { in: ids } },
      include: { project: { select: { userId: true } } },
    });

    const owned = images.every((img) => img.project.userId === session.user?.id);
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (action === "delete") {
      await db.generatedImage.deleteMany({
        where: { id: { in: ids } },
      });
      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
