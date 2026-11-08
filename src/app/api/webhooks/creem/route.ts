import { NextResponse } from "next/server";
import { isCreemArmed } from "@/lib/billing/provider";
import { verifyCreemSignature } from "@/lib/creem/signature";
import { handleCreemWebhookEvent, type CreemWebhookEvent } from "@/lib/creem/webhook";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CREEM_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  const valid = verifyCreemSignature(rawBody, req.headers.get("creem-signature"), secret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Signature was valid, but Lemon is still the armed provider. Ask Creem to
  // retry so the event is applied after BILLING_PROVIDER=creem is set.
  if (!isCreemArmed()) {
    return NextResponse.json(
      { error: "creem_not_armed", message: "Set BILLING_PROVIDER=creem before accepting Creem webhooks" },
      { status: 503 }
    );
  }

  let event: CreemWebhookEvent;
  try {
    event = JSON.parse(rawBody) as CreemWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleCreemWebhookEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error(
      "Creem webhook failed",
      event.id ?? "unknown",
      event.eventType ?? "unknown",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
