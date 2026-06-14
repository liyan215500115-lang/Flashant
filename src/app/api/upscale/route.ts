import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { imageUrl } = await req.json();
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "REPLICATE_API_KEY not set" }, { status: 500 });

  try {
    // Create prediction
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738ddb8b",
        input: { image: imageUrl, scale: 4, face_enhance: false },
      }),
    });
    if (!predRes.ok) {
      const err = await predRes.text();
      return NextResponse.json({ error: `Replicate error: ${predRes.status} ${err}` }, { status: 500 });
    }
    const pred = await predRes.json() as { id: string };

    // Poll for result
    let result: { status: string; output?: string; error?: string } | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await pollRes.json() as { status: string; output?: string; error?: string };
      if (data.status === "succeeded") { result = data; break; }
      if (data.status === "failed") { result = data; break; }
    }

    if (result?.status === "succeeded" && result.output) {
      return NextResponse.json({ url: result.output });
    }
    return NextResponse.json({ error: "Upscale timed out or failed", detail: result?.error }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
