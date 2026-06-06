import "server-only";

import { encryptToken, decryptToken } from "@/lib/token-manager";
import { db } from "@/lib/db";

interface TikTokTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  sellerId?: string;
}

interface TikTokProductInput {
  title: string;
  description?: string;
  images: { url: string; alt?: string }[];
}

export async function storeTikTokConnection(
  userId: string,
  storeName: string,
  tokens: TikTokTokens
) {
  const encrypted = encryptToken(tokens.accessToken);
  const encryptedRefresh = tokens.refreshToken
    ? encryptToken(tokens.refreshToken)
    : null;

  await db.platformConnection.upsert({
    where: { userId_platform: { userId, platform: "TIKTOK_SHOP" } },
    update: {
      accessTokenEncrypted: encrypted,
      refreshTokenEncrypted: encryptedRefresh,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      platformStoreName: storeName,
      platformUserId: tokens.sellerId,
      isActive: true,
    },
    create: {
      userId,
      platform: "TIKTOK_SHOP",
      accessTokenEncrypted: encrypted,
      refreshTokenEncrypted: encryptedRefresh,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      platformStoreName: storeName,
      platformUserId: tokens.sellerId,
    },
  });
}

export async function getTikTokToken(
  userId: string
): Promise<{ accessToken: string; sellerId: string } | null> {
  const conn = await db.platformConnection.findUnique({
    where: { userId_platform: { userId, platform: "TIKTOK_SHOP" } },
  });
  if (!conn || !conn.platformStoreName) return null;

  if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
    if (conn.refreshTokenEncrypted) {
      const refreshed = await refreshTikTokToken(conn.refreshTokenEncrypted);
      if (refreshed) {
        return {
          accessToken: refreshed.accessToken,
          sellerId: conn.platformUserId ?? "",
        };
      }
    }
    await db.platformConnection.update({
      where: { id: conn.id },
      data: { isActive: false },
    });
    return null;
  }

  const accessToken = decryptToken(conn.accessTokenEncrypted);
  if (!accessToken) return null;

  return {
    accessToken,
    sellerId: conn.platformUserId ?? "",
  };
}

async function refreshTikTokToken(
  encryptedRefreshToken: string
): Promise<{ accessToken: string } | null> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  if (!refreshToken) return null;

  const clientId = process.env.TIKTOK_CLIENT_ID;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const refreshUrl = new URL("https://auth.tiktok-shops.com/api/v2/token/refresh");
    refreshUrl.searchParams.set("app_key", clientId);
    refreshUrl.searchParams.set("app_secret", clientSecret);
    refreshUrl.searchParams.set("refresh_token", refreshToken);
    refreshUrl.searchParams.set("grant_type", "refresh_token");

    const res = await fetch(refreshUrl.toString());

    if (!res.ok) return null;
    const data = await res.json();
    return { accessToken: data.access_token };
  } catch {
    return null;
  }
}

export async function publishToTikTokShop(
  userId: string,
  product: TikTokProductInput
): Promise<{ postId: string; postUrl: string } | null> {
  const token = await getTikTokToken(userId);
  if (!token) return null;

  try {
    const res = await fetch(
      "https://open-api.tiktokglobalshop.com/api/products",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seller_id: token.sellerId,
          product_name: product.title,
          description: product.description ?? product.title,
          main_images: product.images.map((img) => ({
            uri: img.url,
          })),
        }),
      }
    );

    if (res.status === 401) {
      await db.platformConnection.updateMany({
        where: { userId, platform: "TIKTOK_SHOP" },
        data: { isActive: false },
      });
      return null;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      data?: { product_id?: string };
    };
    const productId = data.data?.product_id ?? "unknown";

    return {
      postId: productId,
      postUrl: `https://seller.tiktokglobalshop.com/product/${productId}`,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("TikTok API error")
    ) {
      throw error;
    }
    throw error;
  }
}
