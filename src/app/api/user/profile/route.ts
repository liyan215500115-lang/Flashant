import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, image } = await req.json();

    const data: { name?: string; image?: string | null } = {};
    if (name && typeof name === "string" && name.trim().length > 0) {
      data.name = name.trim();
    }
    if (image !== undefined) {
      data.image = image || null; // empty string → null (remove avatar)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data,
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
