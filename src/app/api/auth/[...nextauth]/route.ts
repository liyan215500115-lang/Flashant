import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { chooseAuthOrigin, rewriteUrlOrigin } from "@/lib/auth-base-url";

/** Keep Auth.js on the host the browser used, not the Vercel deployment host. */
function onPublicHost(req: NextRequest): NextRequest {
  const origin = chooseAuthOrigin({
    env: process.env,
    forwardedHost: req.headers.get("x-forwarded-host"),
    forwardedProto: req.headers.get("x-forwarded-proto"),
    host: req.headers.get("host"),
    requestUrl: req.nextUrl.href,
  });
  if (!origin || origin === req.nextUrl.origin) return req;
  return new NextRequest(rewriteUrlOrigin(req.nextUrl.href, origin), req);
}

export function GET(req: NextRequest) {
  return handlers.GET(onPublicHost(req));
}

export function POST(req: NextRequest) {
  return handlers.POST(onPublicHost(req));
}
