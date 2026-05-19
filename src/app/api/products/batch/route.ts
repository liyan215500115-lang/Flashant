import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { action, ids } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  if (!["delete", "publish", "regenerate"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Verify all projects belong to user
  const projects = await db.imageProject.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, status: true },
  });

  const foundIds = new Set(projects.map((p) => p.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Projects not found: ${missing.join(", ")}` },
      { status: 404 }
    );
  }

  if (action === "delete") {
    await db.imageProject.deleteMany({
      where: { id: { in: ids }, userId },
    });
    return NextResponse.json({ deleted: ids.length });
  }

  if (action === "publish") {
    // Only publish projects in GENERATED state
    const publishable = projects.filter((p) => p.status === "GENERATED");
    if (publishable.length > 0) {
      await db.imageProject.updateMany({
        where: { id: { in: publishable.map((p) => p.id) } },
        data: { status: "PUBLISHED" },
      });
    }
    const skipped = projects.length - publishable.length;
    return NextResponse.json({ published: publishable.length, skipped });
  }

  if (action === "regenerate") {
    // Reset projects to DRAFT so they can be regenerated
    await db.imageProject.updateMany({
      where: { id: { in: ids }, userId },
      data: { status: "DRAFT" },
    });
    return NextResponse.json({ regenerated: ids.length });
  }
}
