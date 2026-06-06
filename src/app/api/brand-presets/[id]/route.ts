import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveFileLocally } from "@/lib/s3";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.brandPreset.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const name = formData.get("name") as string | null;
  const colorsRaw = formData.get("colors") as string | null;
  const fontsRaw = formData.get("fonts") as string | null;
  const logoFile = formData.get("logo") as File | null;
  const logoUrlStr = formData.get("logoUrl") as string | null;

  const data: Record<string, unknown> = {};
  if (name?.trim()) data.name = name.trim();
  if (logoUrlStr) data.logoUrl = logoUrlStr;

  if (colorsRaw) {
    try { data.colors = JSON.parse(colorsRaw); } catch { /* ignore */ }
  }
  if (fontsRaw) {
    try { data.fonts = JSON.parse(fontsRaw); } catch { /* ignore */ }
  }

  if (logoFile && logoFile.type.startsWith("image/")) {
    const { publicUrl } = await saveFileLocally(logoFile);
    data.logoUrl = publicUrl;
  }

  const preset = await db.brandPreset.update({
    where: { id },
    data,
  });

  return NextResponse.json({ preset });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.brandPreset.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.brandPreset.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
