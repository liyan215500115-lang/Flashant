import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { openStoredObject } from "@/lib/s3";
import { isOwnedStorageKey, storedObjectResponse } from "@/lib/stored-image";

/**
 * Same-origin bytes for a generated image we stored.
 * The object is streamed. Buffering it into a Uint8Array and returning that
 * from NextResponse drops the connection on larger older files
 * (ERR_CONNECTION_CLOSED) before the browser can save them.
 * A provider URL is not redirected to. A failed read is JSON, not an aborted socket.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const image = await db.generatedImage.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    });
    if (!image?.project || image.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!isOwnedStorageKey(image.s3Key)) {
      return NextResponse.json({ error: "Image is not in storage" }, { status: 409 });
    }

    const file = await openStoredObject(image.s3Key);
    return storedObjectResponse(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "read_failed";
    console.error(`Failed to read stored image: ${message}`);
    return NextResponse.json({ error: "Image could not be read" }, { status: 502 });
  }
}
