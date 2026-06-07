import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSignedGetUrl, uploadBuffer, hasS3Config } from "@/lib/s3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageS3Key } = await req.json();
  if (!imageS3Key) {
    return NextResponse.json({ error: "imageS3Key required" }, { status: 400 });
  }

  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "REPLICATE_API_KEY not set" }, { status: 500 });
  }

  // Get a presigned URL the model can access
  const imageUrl = await getSignedGetUrl(imageS3Key, 3600).catch(
    () => `${process.env.S3_PUBLIC_URL}/${imageS3Key}`
  );

  try {
    // Create prediction
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "lucataco/remove-bg",
        input: { image: imageUrl },
      }),
    });

    if (!predRes.ok) {
      const err = await predRes.text();
      throw new Error(`Replicate error: ${predRes.status} ${err}`);
    }

    const prediction = await predRes.json();
    const predId = prediction.id;

    // Poll for result
    let resultUrl = "";
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const checkRes = await fetch(
        `https://api.replicate.com/v1/predictions/${predId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const check = await checkRes.json();
      if (check.status === "succeeded") {
        resultUrl = check.output;
        break;
      }
      if (check.status === "failed") {
        throw new Error("Background removal failed");
      }
    }

    if (!resultUrl) throw new Error("Background removal timed out");

    // Download result and upload to R2
    const imgRes = await fetch(resultUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    if (hasS3Config()) {
      const uploaded = await uploadBuffer(buffer, "image/png", "bg-removed/");
      return NextResponse.json({
        s3Key: uploaded.s3Key,
        url: uploaded.publicUrl,
      });
    }

    // Dev fallback
    const { saveBufferLocally } = await import("@/lib/s3");
    const local = await saveBufferLocally(buffer, "image/png");
    return NextResponse.json({ s3Key: local.s3Key, url: local.publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Background removal failed" },
      { status: 500 }
    );
  }
}
