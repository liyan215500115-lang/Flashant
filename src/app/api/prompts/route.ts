import "server-only";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const templates = await db.promptTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      nameZh: true,
      description: true,
      category: true,
      previewUrl: true,
    },
  });

  return NextResponse.json({ templates });
}
