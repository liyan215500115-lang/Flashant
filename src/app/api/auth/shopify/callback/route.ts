import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { storeShopifyConnection } from "@/lib/platform/shopify";
import { db } from "@/lib/db";

/**
 * GET /api/auth/shopify/callback?code=xxx&shop=xxx&state=xxx
 * Handles the OAuth callback from Shopify.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const shop = req.nextUrl.searchParams.get("shop");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !shop) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", req.url)
    );
  }

  // Decode state to get userId
  let userId: string | null = null;
  if (state) {
    try {
      const decoded = JSON.parse(
        Buffer.from(state, "base64url").toString("utf-8")
      );
      userId = decoded.userId || null;
    } catch {
      // state decode failed — will verify below
    }
  }

  if (!userId) {
    return NextResponse.redirect(
      new URL("/integrations?error=invalid_state", req.url)
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/integrations?error=config_missing", req.url)
    );
  }

  try {
    const res = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.redirect(
        new URL("/integrations?error=token_exchange_failed", req.url)
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      scope: string;
    };

    // Store the connection
    await storeShopifyConnection(userId, shop, {
      accessToken: data.access_token,
      scope: data.scope,
    });
  } catch {
    return NextResponse.redirect(
      new URL("/integrations?error=token_exchange_failed", req.url)
    );
  }

  return NextResponse.redirect(
    new URL("/integrations?connected=shopify", req.url)
  );
}
