import "server-only";
import type { RequestOptions as HttpRequestOptions } from "http";
import type { RequestOptions as HttpsRequestOptions } from "https";

/**
 * A fetch implementation that routes through a SOCKS5 proxy.
 * On Vercel (serverless), always returns the native fetch.
 * On local dev, loads proxy modules dynamically only when configured.
 */
export function createSocksFetch(): typeof globalThis.fetch {
  if (process.env.VERCEL === "1") return globalThis.fetch;

  const proxyUrl =
    process.env.SOCKS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    "";
  const isSocks = proxyUrl.startsWith("socks");

  if (!isSocks) return globalThis.fetch;

  // Dynamic require — only loads Node.js modules when proxy is actually configured
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SocksProxyAgent } = require("socks-proxy-agent");
  const https = require("https") as typeof import("https");
  const http = require("http") as typeof import("http");

  const agent = new SocksProxyAgent(proxyUrl);

  return async function socksFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL(input.url);
    const isHttps = url.protocol === "https:";

    const options: HttpRequestOptions & HttpsRequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: init?.method || "GET",
      headers: init?.headers
        ? (init.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : (init.headers as Record<string, string>))
        : {},
      agent,
    };

    return new Promise((resolve, reject) => {
      const mod = isHttps ? https : http;
      const req = mod.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(", "));
          }

          resolve(
            new Response(body.length > 0 ? body : null, {
              status: res.statusCode ?? 200,
              statusText: res.statusMessage ?? "",
              headers,
            })
          );
        });
      });

      req.on("error", reject);
      req.setTimeout(120_000, () => {
        req.destroy(new Error("Request timed out"));
      });

      if (init?.body) {
        req.write(init.body as string);
      }
      req.end();
    });
  };
}
