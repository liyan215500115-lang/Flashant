import { auth } from "@/lib/auth";
import { isCreemArmed } from "@/lib/billing/provider";
import { startBillingCheckout } from "@/lib/billing/checkout";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!isCreemArmed()) {
    return NextResponse.json(
      {
        error: "creem_disabled",
        message: "Set BILLING_PROVIDER=creem to take Creem payments",
      },
      { status: 409 }
    );
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const planTier = typeof body.planTier === "string" ? body.planTier : "";
    const interval = typeof body.interval === "string" ? body.interval : "monthly";

    const result = await startBillingCheckout({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      planTier,
      interval,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("must be PRO") || message.includes("is not set") ? 400 : 500;
    return NextResponse.json({ error: "checkout_error", message }, { status });
  }
}
