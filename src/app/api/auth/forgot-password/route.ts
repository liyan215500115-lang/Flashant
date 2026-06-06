import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendEmail, buildPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const resetUrl = `${
      process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    }/reset-password?token=${token}`;

    // Send the email
    const { subject, html } = buildPasswordResetEmail(resetUrl, user.name ?? undefined);
    await sendEmail({ to: email, subject, html });

    // In dev, return the URL for convenience. In production, never leak the URL.
    return NextResponse.json({
      ok: true,
      resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
