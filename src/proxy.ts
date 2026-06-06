import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/webhooks"];
const API_AUTH_PATTERNS = [
  "/api/products",
  "/api/generate",
  "/api/publish",
  "/api/tasks",
  "/api/lemonsqueezy",
  "/api/upload-url",
  "/api/quota",
  "/api/prompts",
  "/api/assets",
  "/api/listings",
];
const QUOTA_GATED_PATTERNS = ["/api/generate"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── i18n: apply locale from cookie ──
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = localeCookie && ["en", "zh"].includes(localeCookie) ? localeCookie : "zh";

  // Public paths — no auth needed
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    res.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 31536000 });
    return res;
  }

  // ── Layer 1: Auth protection for API routes ──
  const isProtectedApi = API_AUTH_PATTERNS.some((p) =>
    pathname.startsWith(p)
  );

  if (isProtectedApi) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Layer 2: Quota awareness for AI generation routes ──
    if (QUOTA_GATED_PATTERNS.some((p) => pathname.startsWith(p))) {
      const sub = await db.subscription.findUnique({
        where: { userId: session.user.id },
        select: { planTier: true, currentPeriodStart: true },
      });

      const tier = sub?.planTier ?? "FREE";

      if (tier === "FREE") {
        const used = await db.generatedImage.count({
          where: {
            project: { userId: session.user.id },
            createdAt: { gte: sub?.currentPeriodStart ?? new Date(0) },
          },
        });

        if (used >= 10) {
          return NextResponse.json(
            {
              error: "quota_exceeded",
              message:
                "Monthly quota exhausted (10/10). Please upgrade to continue.",
              tier: "FREE",
            },
            { status: 402 }
          );
        }
      }
    }

    const res = NextResponse.next();
    res.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 31536000 });
    return res;
  }

  // ── Page routes: redirect to login if no session ──
  const session = await auth();
  if (!session?.user?.id) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const res = NextResponse.next();
  res.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 31536000 });
  return res;
}

export const config = {
  matcher: [
    "/((?!_next|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
