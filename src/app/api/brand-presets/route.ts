import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasS3Config, saveFileLocally } from "@/lib/s3";
import { serverT } from "@/lib/server-t";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const presets = await db.brandPreset.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const name = formData.get("name") as string;
  const colorsRaw = formData.get("colors") as string;
  const fontsRaw = formData.get("fonts") as string;
  const logoFile = formData.get("logo") as File | null;
  const logoUrlStr = formData.get("logoUrl") as string | null;

  if (!name?.trim()) {
    return NextResponse.json({ error: await serverT("error.brandNameRequired") }, { status: 400 });
  }

  let colors: string[] = [];
  try { colors = JSON.parse(colorsRaw || "[]"); } catch { /* ignore */ }
  let fonts: { heading?: string; body?: string } | null = null;
  try { fonts = JSON.parse(fontsRaw || "null"); } catch { /* ignore */ }

  let logoUrl: string | null = logoUrlStr ?? null;
  if (logoFile && logoFile.type.startsWith("image/")) {
    if (hasS3Config()) {
      // S3 upload — for now, use local save in dev
      const { publicUrl } = await saveFileLocally(logoFile);
      logoUrl = publicUrl;
    } else {
      const { publicUrl } = await saveFileLocally(logoFile);
      logoUrl = publicUrl;
    }
  }

  const preset = await db.brandPreset.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      logoUrl,
      colors: colors.length > 0 ? colors : undefined,
      fonts: fonts ?? undefined,
    },
  });

  return NextResponse.json({ preset }, { status: 201 });
}
