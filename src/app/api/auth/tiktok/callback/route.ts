import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { storeTikTokConnection } from "@/lib/platform/tiktok";

/**
 * GET /api/auth/tiktok/callback?code=xxx&state=xxx
 * Handles the OAuth callback from TikTok Shop.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", req.url)
    );
  }

  let userId: string | null = null;
  if (state) {
    try {
      const decoded = JSON.parse(
        Buffer.from(state, "base64url").toString("utf-8")
      );
      userId = decoded.userId || null;
    } catch {
      // state decode failed
    }
  }

  if (!userId) {
    return NextResponse.redirect(
      new URL("/integrations?error=invalid_state", req.url)
    );
  }

  const clientId = process.env.TIKTOK_CLIENT_ID;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/integrations?error=config_missing", req.url)
    );
  }

  try {
    const tokenUrl = new URL("https://auth.tiktok-shops.com/api/v2/token/get");
    tokenUrl.searchParams.set("app_key", clientId);
    tokenUrl.searchParams.set("app_secret", clientSecret);
    tokenUrl.searchParams.set("auth_code", code);
    tokenUrl.searchParams.set("grant_type", "authorized_code");

    const res = await fetch(tokenUrl.toString());

    if (!res.ok) {
      return NextResponse.redirect(
        new URL("/integrations?error=token_exchange_failed", req.url)
      );
    }

    const data = (await res.json()) as {
      data?: {
        access_token: string;
        refresh_token: string;
        access_token_expire_in?: number;
        refresh_token_expire_in?: number;
        open_id?: string;
        seller_name?: string;
      };
    };

    const payload = data.data ?? (data as unknown as {
      access_token: string;
      refresh_token: string;
      seller_name?: string;
      open_id?: string;
    });

    await storeTikTokConnection(
      userId,
      payload.seller_name ?? "TikTok Shop",
      {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresAt: undefined,
        sellerId: payload.open_id,
      }
    );
  } catch {
    return NextResponse.redirect(
      new URL("/integrations?error=token_exchange_failed", req.url)
    );
  }

  return NextResponse.redirect(
    new URL("/integrations?connected=tiktok", req.url)
  );
}
