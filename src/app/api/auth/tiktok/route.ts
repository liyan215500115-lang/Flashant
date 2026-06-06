import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/auth/tiktok?userId=xxx
 * Redirects to TikTok Shop OAuth authorization page.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const clientId = process.env.TIKTOK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/tiktok/callback`;
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");

  const authUrl = new URL("https://services.tiktokshop.com/open/authorize");
  authUrl.searchParams.set("service_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl);
}
