import { auth } from "@/lib/auth";
import { isPublicCrawlerPath, isPublicLegalPath, normalizePathname } from "@/lib/legal/paths";
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
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── i18n: apply locale from cookie ──
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = localeCookie && ["en", "zh", "es", "pt-BR", "ja", "de", "fr", "ko", "ar", "it"].includes(localeCookie) ? localeCookie : "en";

  // /aup is a permanent alias of the Acceptable Use Policy.
  if (normalizePathname(pathname) === "/aup") {
    const url = request.nextUrl.clone();
    url.pathname = "/acceptable-use";
    const res = NextResponse.redirect(url, 301);
    res.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 31536000 });
    return res;
  }

  // Public paths — no auth needed. robots.txt and sitemap.xml stay public so
  // crawlers can discover the legal pages; app pages and API routes do not.
  if (
    pathname === "/" ||
    isPublicLegalPath(pathname) ||
    isPublicCrawlerPath(pathname) ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
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

    // Quota enforcement is intentionally off. /api/quota and checkGenerationQuota
    // currently allow every request through (allowed: true, limit: -1) so the UI
    // can say unlimited. This gateway must match that allow-through policy and
    // must not return 402 for /api/generate while real quotas stay disabled.
    //
    // When quotas are restored later, this gateway and checkGenerationQuota must
    // use the same policy, exclude aiProvider "manual", and handle soft-deleted
    // rows according to the product decision at that time.

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
