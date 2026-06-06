import "server-only";

const RESEND_API = "https://api.resend.com/emails";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via the Resend REST API.
 * Set RESEND_API_KEY and RESEND_FROM in your environment.
 * Falls back to console.log in development if no API key is set.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ ok: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "闪象 <noreply@flashant.ai>";

  // In production, fail loudly if API key is missing
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("RESEND_API_KEY is not set — cannot send email");
      return { ok: false };
    }
    // Dev fallback: log to console
    console.log("── Email (dev) ──────────────────────────────");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(html.slice(0, 200));
    console.log("──────────────────────────────────────────────");
    return { ok: true };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend API error:", err);
      return { ok: false };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("Email send failed:", e);
    return { ok: false };
  }
}

/** Generate a password reset email HTML body */
export function buildPasswordResetEmail(resetUrl: string, userName?: string): { subject: string; html: string } {
  const greeting = userName ? `Hi ${userName},` : "Hello,";
  return {
    subject: "Reset your 闪象 password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #18181b; font-size: 20px; font-weight: 600; margin: 0 0 8px;">Reset your password</h2>
        <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          ${greeting} Click the button below to reset your 闪象 password. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #18181b; color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 600;">
          Reset password
        </a>
        <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
          If you didn't request this, you can safely ignore this email.<br/>
          <a href="${resetUrl}" style="color: #a1a1aa;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
        <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
          闪象 Flashant · 一键闪象，万象更新
        </p>
      </div>
    `,
  };
}
