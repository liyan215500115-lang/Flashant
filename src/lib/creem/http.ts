import { NextResponse } from "next/server";
import type { ChargeFailure } from "@/lib/creem/credits";

export function spendErrorResponse(result: ChargeFailure): NextResponse {
  if (result.error === "insufficient_credits") {
    const enterprise = result.tier === "ENTERPRISE" && !result.allotmentConfigured;
    const message = enterprise
      ? `Not enough generation credits. Enterprise has no monthly allotment configured, and the generation wallet has ${result.balance} credits (${result.required} required).`
      : `Not enough generation credits. This request needs ${result.required} credits and the wallet has ${result.balance}.`;
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message,
        balance: result.balance,
        required: result.required,
        tier: result.tier,
        allotmentConfigured: result.allotmentConfigured,
      },
      { status: 402 },
    );
  }

  if (result.error === "moderation_rejected") {
    return NextResponse.json(
      {
        error: "moderation_unavailable",
        message: "Content moderation is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "credits_unavailable",
      message: "Generation credits are temporarily unavailable. Please try again shortly.",
      tier: result.tier,
      allotmentConfigured: result.allotmentConfigured,
    },
    { status: 503 },
  );
}

/** Attach the refund outcome. The message claims a refund only after a successful reversal. */
export async function withRefundFlag(
  response: NextResponse,
  refund: { reversed: boolean },
): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (refund.reversed && typeof body.message === "string" && body.message.length > 0) {
    body.message = `${body.message} Generation credits were refunded.`;
  }
  body.creditsRefunded = refund.reversed;
  return NextResponse.json(body, { status: response.status });
}
