import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return Response.redirect(new URL(`/settings?error=douyin_oauth_denied`, request.url));
  }

  if (!code) {
    const redirectUri = `${env.APP_URL}/api/oauth/douyin`;
    const authUrl = new URL("https://open.douyin.com/platform/oauth/connect/");
    authUrl.searchParams.set("client_key", env.DOUYIN_CLIENT_ID || "");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "video.create,video.upload");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", session.user.id);
    return Response.redirect(authUrl.toString());
  }

  if (!env.DOUYIN_CLIENT_ID || !env.DOUYIN_CLIENT_SECRET) {
    return Response.redirect(new URL("/settings?error=douyin_not_configured", request.url));
  }

  try {
    const tokenRes = await fetch("https://open.douyin.com/oauth/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_key: env.DOUYIN_CLIENT_ID,
        client_secret: env.DOUYIN_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.data?.access_token) {
      const expiresAt = new Date(Date.now() + (tokenData.data.expires_in || 86400) * 1000);

      const existing = await db.platformAccount.findFirst({
        where: { platform: "douyin" },
      });

      if (existing) {
        await db.platformAccount.update({
          where: { id: existing.id },
          data: {
            accessToken: tokenData.data.access_token,
            refreshToken: tokenData.data.refresh_token || "",
            expiresAt,
          },
        });
      } else {
        await db.platformAccount.create({
          data: {
            platform: "douyin",
            accessToken: tokenData.data.access_token,
            refreshToken: tokenData.data.refresh_token || "",
            expiresAt,
          },
        });
      }
    }

    return Response.redirect(new URL("/settings?success=douyin_connected", request.url));
  } catch {
    return Response.redirect(new URL("/settings?error=douyin_token_failed", request.url));
  }
}
