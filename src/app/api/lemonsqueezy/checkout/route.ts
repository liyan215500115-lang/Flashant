import { auth } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/lemonsqueezy/billing";
import { checkoutBaseUrl, evaluateCheckoutGate } from "@/lib/lemonsqueezy/preview-isolation";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const variantId = body.variantId as string | undefined;
    const planTier = body.planTier as string | undefined;

    if (!variantId || !planTier) {
      return NextResponse.json(
        { error: "variantId and planTier are required" },
        { status: 400 }
      );
    }

    const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const gate = evaluateCheckoutGate({
      vercelEnv: process.env.VERCEL_ENV,
      previewBillingArmed: process.env.FLASHANT_PREVIEW_BILLING,
      databaseUrl,
    });
    if (!gate.allow) {
      return NextResponse.json(
        { error: "preview_billing_blocked", message: gate.reason },
        { status: gate.status }
      );
    }

    const baseUrl = checkoutBaseUrl({
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });

    const result = await createCheckoutSession({
      userId: session.user.id,
      variantId,
      planTier: planTier as "PRO" | "BUSINESS",
      successUrl: `${baseUrl}/settings/billing?success=true`,
      cancelUrl: `${baseUrl}/settings/billing?canceled=true`,
      testMode: gate.testMode,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "checkout_error", message: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
