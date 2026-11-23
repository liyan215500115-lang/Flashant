import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { readObjectBuffer } from "@/lib/s3";
import { isOwnedStorageKey } from "@/lib/stored-image";

/**
 * Same-origin bytes for a generated image we stored.
 * A provider URL is not redirected to, so a failed download cannot leave this page.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const image = await db.generatedImage.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!image || image.project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isOwnedStorageKey(image.s3Key)) {
    return NextResponse.json({ error: "Image is not in storage" }, { status: 409 });
  }

  try {
    const file = await readObjectBuffer(image.s3Key);
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "read_failed";
    console.error(`Failed to read stored image: ${message}`);
    return NextResponse.json({ error: "Image could not be read" }, { status: 502 });
  }
}
