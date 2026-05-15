import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe/billing";
import type { PlanTier } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId, planTier, successUrl, cancelUrl } = await req.json();

  if (!priceId || !planTier) {
    return NextResponse.json(
      { error: "priceId and planTier are required" },
      { status: 400 }
    );
  }

  try {
    const result = await createCheckoutSession({
      userId: session.user.id,
      priceId,
      planTier: planTier as PlanTier,
      successUrl: successUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
      cancelUrl: cancelUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "stripe_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
