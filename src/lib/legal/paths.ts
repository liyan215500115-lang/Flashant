export const PUBLIC_LEGAL_PATHS = [
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/contact",
  "/aup",
] as const;

export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "");
  return pathname;
}

export function isPublicLegalPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return (PUBLIC_LEGAL_PATHS as readonly string[]).includes(path);
}
