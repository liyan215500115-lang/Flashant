import { auth } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/lemonsqueezy/billing";
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

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await createCheckoutSession({
      userId: session.user.id,
      variantId,
      planTier: planTier as "PRO" | "BUSINESS",
      successUrl: `${baseUrl}/settings/billing?success=true`,
      cancelUrl: `${baseUrl}/settings/billing?canceled=true`,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "checkout_error", message: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
