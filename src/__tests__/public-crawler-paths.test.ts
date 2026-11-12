import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/legal/copy";
import { PUBLIC_INDEXABLE_PATHS } from "@/lib/legal/paths";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { proxy } from "@/proxy";

const PUBLIC_PATHS = [
  "/robots.txt",
  "/sitemap.xml",
  "/",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/contact",
  "/privacy/",
  "/aup",
];

function requestFor(pathname: string) {
  return new NextRequest(new URL(pathname, SITE_URL));
}

function loginCallback(response: Response) {
  const location = response.headers.get("location");
  if (!location) return null;
  const url = new URL(location, SITE_URL);
  if (url.pathname !== "/login") return null;
  return url.searchParams.get("callbackUrl");
}

describe("public crawler and legal paths", () => {
  it("does not redirect robots.txt, sitemap.xml, or legal pages to login", async () => {
    for (const pathname of PUBLIC_PATHS) {
      const response = await proxy(requestFor(pathname));
      expect(loginCallback(response), pathname).toBeNull();
    }
  });

  it("keeps app pages and protected APIs behind auth", async () => {
    const studio = await proxy(requestFor("/studio"));
    expect(studio.status).toBe(307);
    expect(loginCallback(studio)).toBe("/studio");

    const nestedCrawler = await proxy(requestFor("/robots.txt.bak"));
    expect(nestedCrawler.status).toBe(307);
    expect(loginCallback(nestedCrawler)).toBe("/robots.txt.bak");

    const generate = await proxy(requestFor("/api/generate"));
    expect(generate.status).toBe(401);
    expect(loginCallback(generate)).toBeNull();
  });

  it("allows the public pages in robots.txt and does not disallow them", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const allowed = rules.flatMap((rule) => [rule.allow ?? []].flat());
    const disallowed = rules.flatMap((rule) => [rule.disallow ?? []].flat());

    expect(result.host).toBe("https://flashant.cn");
    expect(result.sitemap).toBe("https://flashant.cn/sitemap.xml");
    for (const pathname of PUBLIC_INDEXABLE_PATHS) {
      expect(allowed, pathname).toContain(pathname);
      expect(disallowed, pathname).not.toContain(pathname);
    }
  });

  it("lists the same public URLs in the sitemap", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://flashant.cn/",
      "https://flashant.cn/privacy",
      "https://flashant.cn/terms",
      "https://flashant.cn/acceptable-use",
      "https://flashant.cn/contact",
    ]);
  });
});
