import { auth } from "@/lib/auth";
import { isCreemArmed } from "@/lib/billing/provider";
import { createCreemPortalLink } from "@/lib/creem/client";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isCreemArmed()) {
      return NextResponse.json(
        { error: "creem_disabled", message: "Set BILLING_PROVIDER=creem to open the Creem portal" },
        { status: 409 }
      );
    }

    const subscription = await db.subscription.findUnique({
      where: { userId: session.user.id },
      select: { billingCustomerId: true, billingProvider: true },
    });
    if (!subscription?.billingCustomerId || subscription.billingProvider !== "creem") {
      return NextResponse.json(
        { error: "no_creem_customer", message: "No Creem customer is linked to this account yet" },
        { status: 404 }
      );
    }

    const url = await createCreemPortalLink(subscription.billingCustomerId);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: "portal_error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
