export const PUBLIC_LEGAL_PATHS = [
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/contact",
  "/aup",
] as const;

/** Discovery files that must be readable without a session. */
export const PUBLIC_CRAWLER_PATHS = ["/robots.txt", "/sitemap.xml"] as const;

/**
 * Pages crawlers may index. `/aup` stays a public alias but is a redirect,
 * so it is not listed here.
 */
export const PUBLIC_INDEXABLE_PATHS = [
  "/",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/contact",
] as const;

export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "");
  return pathname;
}

export function isPublicLegalPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return (PUBLIC_LEGAL_PATHS as readonly string[]).includes(path);
}

export function isPublicCrawlerPath(pathname: string): boolean {
  return (PUBLIC_CRAWLER_PATHS as readonly string[]).includes(normalizePathname(pathname));
}
