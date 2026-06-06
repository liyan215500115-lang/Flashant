import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/auth/shopify?shop=xxx.myshopify.com&userId=xxx
 * Redirects to Shopify OAuth authorization page.
 */
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  const userId = req.nextUrl.searchParams.get("userId");

  if (!shop || !userId) {
    return NextResponse.json(
      { error: "shop and userId are required" },
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "SHOPIFY_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/shopify/callback`;
  const state = Buffer.from(JSON.stringify({ userId, shop })).toString("base64url");
  const scope = "write_products,read_products";

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl);
}
