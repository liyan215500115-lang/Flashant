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
    return Response.redirect(new URL(`/settings?error=kuaishou_oauth_denied`, request.url));
  }

  if (!code) {
    const redirectUri = `${env.APP_URL}/api/oauth/kuaishou`;
    const authUrl = new URL("https://open.kuaishou.com/platform/oauth/connect/");
    authUrl.searchParams.set("app_id", env.KUAISHOU_CLIENT_ID || "");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "video.upload,video.publish");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", session.user.id);
    return Response.redirect(authUrl.toString());
  }

  if (!env.KUAISHOU_CLIENT_ID || !env.KUAISHOU_CLIENT_SECRET) {
    return Response.redirect(new URL("/settings?error=kuaishou_not_configured", request.url));
  }

  try {
    const tokenRes = await fetch("https://open.kuaishou.com/oauth/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: env.KUAISHOU_CLIENT_ID,
        app_secret: env.KUAISHOU_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000);

      const existing = await db.platformAccount.findFirst({
        where: { platform: "kuaishou" },
      });

      if (existing) {
        await db.platformAccount.update({
          where: { id: existing.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || "",
            expiresAt,
          },
        });
      } else {
        await db.platformAccount.create({
          data: {
            platform: "kuaishou",
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || "",
            expiresAt,
          },
        });
      }
    }

    return Response.redirect(new URL("/settings?success=kuaishou_connected", request.url));
  } catch {
    return Response.redirect(new URL("/settings?error=kuaishou_token_failed", request.url));
  }
}
