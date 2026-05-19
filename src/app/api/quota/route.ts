import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkGenerationQuota } from "@/lib/stripe/billing";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quota = await checkGenerationQuota(session.user.id);
  return NextResponse.json({
    used: quota.used,
    limit: quota.limit,
    tier: quota.tier,
    allowed: quota.allowed,
  });
}
