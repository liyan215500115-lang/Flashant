import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkGenerationQuota } from "@/lib/lemonsqueezy/billing";
import { presentQuota } from "@/lib/quota-display";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quota = presentQuota(await checkGenerationQuota(session.user.id));
  // 0/0 with allowed false is a failed wallet read, not a confirmed empty balance.
  const quotaKnown = !(quota.used === 0 && quota.limit === 0 && quota.balance === 0 && quota.allowed === false);
  return NextResponse.json({
    used: quota.used,
    limit: quota.limit,
    tier: quota.tier,
    allowed: quota.allowed,
    balance: quota.balance,
    allotmentConfigured: quota.allotmentConfigured,
    unlimited: quota.unlimited,
    quotaKnown,
  });
}
