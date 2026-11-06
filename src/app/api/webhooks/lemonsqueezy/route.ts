import { NextResponse } from "next/server";
import { handleSubscriptionEvent } from "@/lib/lemonsqueezy/billing";
import {
  evaluateWebhookGate,
  isKnownProductionDatabase,
} from "@/lib/lemonsqueezy/preview-isolation";
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

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: true });
  }

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  return NextResponse.json({
    ok: true,
    environment: "preview",
    billingArmed: process.env.FLASHANT_PREVIEW_BILLING === "1",
    productionDatabaseLocked: isKnownProductionDatabase(databaseUrl),
    databaseConfigured: Boolean(databaseUrl),
    webhookSecretConfigured: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET),
    lemonApiKeyConfigured: Boolean(process.env.LEMONSQUEEZY_API_KEY),
    lemonStoreConfigured: Boolean(process.env.LEMONSQUEEZY_STORE_ID),
  });
}

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

  let event: {
    meta?: { event_name?: string; test_mode?: boolean };
    data?: { id?: string };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const gate = evaluateWebhookGate({
    vercelEnv: process.env.VERCEL_ENV,
    previewBillingArmed: process.env.FLASHANT_PREVIEW_BILLING,
    databaseUrl,
    testMode: event.meta?.test_mode === true,
  });

  if (gate.action === "skip") {
    return NextResponse.json({ received: true, skipped: gate.reason });
  }
  if (gate.action === "refuse") {
    return NextResponse.json({ error: gate.reason }, { status: gate.status });
  }

  // Idempotency: skip duplicate events. Refusals are not recorded, so Lemon
  // can retry after Preview env is corrected.
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
