import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chargeScreenedGeneration, refundGenerationDebit, type DebitHold } from "@/lib/creem/credits-runtime";
import { spendErrorResponse, withRefundFlag } from "@/lib/creem/http";
import {
  creemModerationMode,
  moderationHttpResponse,
  SCREEN_PLACEHOLDERS,
  screenGenerationPrompts,
} from "@/lib/creem/moderation";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { imageUrl } = await req.json();
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  const moderation = await screenGenerationPrompts({
    userId,
    prompts: [],
    placeholder: SCREEN_PLACEHOLDERS.upscale,
  });
  const blocked = moderationHttpResponse(moderation);
  if (blocked) return blocked;

  const generationId = crypto.randomUUID();
  let hold: DebitHold | null = null;
  if (creemModerationMode() !== "off") {
    const charged = await chargeScreenedGeneration({
      userId,
      gate: moderation,
      imageCount: 1,
      reference: `gen:${generationId}`,
      idempotencyKey: `debit:${generationId}`,
    });
    if (!charged.ok) return spendErrorResponse(charged);
    hold = charged.hold;
  }

  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    const response = NextResponse.json({ error: "REPLICATE_API_KEY not set" }, { status: 500 });
    return hold ? withRefundFlag(response, await refundGenerationDebit(hold)) : response;
  }

  try {
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
      const response = NextResponse.json({ error: `Replicate error: ${predRes.status} ${err}` }, { status: 500 });
      return hold ? withRefundFlag(response, await refundGenerationDebit(hold)) : response;
    }
    const pred = await predRes.json() as { id: string };

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
    const response = NextResponse.json(
      { error: "Upscale timed out or failed", message: "Upscale failed", detail: result?.error },
      { status: 500 },
    );
    return hold ? withRefundFlag(response, await refundGenerationDebit(hold)) : response;
  } catch (e) {
    const response = NextResponse.json(
      { error: (e as Error).message, message: "Upscale failed" },
      { status: 500 },
    );
    return hold ? withRefundFlag(response, await refundGenerationDebit(hold)) : response;
  }
}
