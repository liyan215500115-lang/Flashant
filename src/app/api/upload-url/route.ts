import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUploadUrl, hasS3Config, saveFileLocally } from "@/lib/s3";
import { serverT } from "@/lib/server-t";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasS3Config()) {
    return NextResponse.json({ mode: "local" });
  }

  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("fileName") ?? "image.png";
  const mimeType = searchParams.get("mimeType") ?? "image/png";

  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
  if (!allowedTypes.includes(mimeType)) {
    return NextResponse.json(
      { error: `MIME type "${mimeType}" not allowed` },
      { status: 400 }
    );
  }

  try {
    const { uploadUrl, s3Key, publicUrl } = await createUploadUrl(
      fileName,
      mimeType
    );
    return NextResponse.json({ mode: "s3", uploadUrl, s3Key, publicUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error: "s3_error",
        message: error instanceof Error ? error.message : "S3 upload URL generation failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (hasS3Config()) {
    return NextResponse.json(
      { error: "Use GET /api/upload-url for S3 pre-signed uploads" },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: await serverT("error.invalidImage") },
        { status: 400 }
      );
    }

    const { s3Key, publicUrl } = await saveFileLocally(file);
    return NextResponse.json({ s3Key, publicUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error: "upload_error",
        message: error instanceof Error ? error.message : await serverT("error.fileSaveFailed"),
      },
      { status: 500 }
    );
  }
}
