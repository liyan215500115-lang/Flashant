import "server-only";

import { encryptToken, decryptToken } from "@/lib/token-manager";
import { db } from "@/lib/db";

interface ShopifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

interface ShopifyProductInput {
  title: string;
  description?: string;
  images: { url: string; alt?: string }[];
}

export async function storeShopifyConnection(
  userId: string,
  storeName: string,
  tokens: ShopifyTokens
) {
  const encrypted = encryptToken(tokens.accessToken);
  const encryptedRefresh = tokens.refreshToken
    ? encryptToken(tokens.refreshToken)
    : null;

  await db.platformConnection.upsert({
    where: { userId_platform: { userId, platform: "SHOPIFY" } },
    update: {
      accessTokenEncrypted: encrypted,
      refreshTokenEncrypted: encryptedRefresh,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      platformStoreName: storeName,
      isActive: true,
    },
    create: {
      userId,
      platform: "SHOPIFY",
      accessTokenEncrypted: encrypted,
      refreshTokenEncrypted: encryptedRefresh,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      platformStoreName: storeName,
    },
  });
}

export async function getShopifyToken(
  userId: string
): Promise<{ accessToken: string; storeName: string } | null> {
  const conn = await db.platformConnection.findUnique({
    where: { userId_platform: { userId, platform: "SHOPIFY" } },
  });
  if (!conn || !conn.platformStoreName) return null;

  // Check expiry and refresh if needed
  if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
    if (conn.refreshTokenEncrypted) {
      const refreshed = await refreshShopifyToken(
        conn.platformStoreName,
        conn.refreshTokenEncrypted
      );
      if (refreshed) {
        return {
          accessToken: refreshed.accessToken,
          storeName: conn.platformStoreName ?? "",
        };
      }
    }
    // Mark inactive if refresh fails
    await db.platformConnection.update({
      where: { id: conn.id },
      data: { isActive: false },
    });
    return null;
  }

  const accessToken = decryptToken(conn.accessTokenEncrypted);
  if (!accessToken) return null;

  return { accessToken, storeName: conn.platformStoreName };
}

async function refreshShopifyToken(
  storeName: string,
  encryptedRefreshToken: string
): Promise<{ accessToken: string } | null> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  if (!refreshToken) return null;

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(
      `https://${storeName}.myshopify.com/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return { accessToken: data.access_token };
  } catch {
    return null;
  }
}

export async function publishToShopify(
  userId: string,
  product: ShopifyProductInput
): Promise<{ postId: string; postUrl: string } | null> {
  const token = await getShopifyToken(userId);
  if (!token) return null;

  const storeName = token.storeName;

  try {
    const res = await fetch(
      `https://${storeName}.myshopify.com/admin/api/2024-04/products.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: {
            title: product.title,
            body_html: product.description,
            images: product.images.map((img) => ({
              src: img.url,
              alt: img.alt ?? product.title,
            })),
          },
        }),
      }
    );

    if (res.status === 401) {
      // Token expired — mark and return null
      await db.platformConnection.updateMany({
        where: { userId, platform: "SHOPIFY" },
        data: { isActive: false },
      });
      return null;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Shopify API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    const productId = data.product.id;
    return {
      postId: String(productId),
      postUrl: `https://admin.shopify.com/store/${storeName}/products/${productId}`,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Shopify API error")) {
      throw error;
    }
    // Rate limit or network error — throw for caller to handle
    throw error;
  }
}
