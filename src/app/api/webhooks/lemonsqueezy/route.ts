import { NextResponse } from "next/server";
import { handleSubscriptionEvent } from "@/lib/lemonsqueezy/billing";
import crypto from "crypto";

// ── Idempotency (in-memory; production should use Redis/DB) ──────────────
const processedEvents = new Set<string>();

// ── Signature Verification ───────────────────────────────────────────────

async function verifyLemonSqueezySignature(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    return false;
  }

  const signature = req.headers.get("x-signature");
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}

// ── Route Handler ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Verify signature
  const valid = await verifyLemonSqueezySignature(req, rawBody);

  if (!valid) {
    // In development, allow through for local testing without webhook secret
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.warn("Lemon Squeezy webhook signature validation skipped (dev mode)");
  }

  let event: { meta?: { event_name?: string }; data?: { id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Idempotency: skip duplicate events
  const eventId = event.data?.id ?? event.meta?.event_name ?? "unknown";
  if (eventId !== "unknown" && processedEvents.has(eventId)) {
    return NextResponse.json({ received: true, skipped: "duplicate" });
  }
  if (eventId !== "unknown") {
    processedEvents.add(eventId);
  }

  const result = await handleSubscriptionEvent(event as Parameters<typeof handleSubscriptionEvent>[0]);

  return NextResponse.json({ received: true, result });
}
