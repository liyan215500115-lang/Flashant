import "server-only";

import { SocksProxyAgent } from "socks-proxy-agent";
import * as https from "https";
import * as http from "http";

let _agent: SocksProxyAgent | null = null;

function getAgent(): SocksProxyAgent | undefined {
  const proxyUrl =
    process.env.SOCKS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    "";
  const isSocks = proxyUrl.startsWith("socks");

  if (!isSocks) return undefined;
  if (!_agent) _agent = new SocksProxyAgent(proxyUrl);
  return _agent;
}

/**
 * A fetch implementation that routes through a SOCKS5 proxy.
 * Falls back to global fetch if no SOCKS proxy is configured.
 */
export function createSocksFetch(): typeof globalThis.fetch {
  const agent = getAgent();
  if (!agent) return globalThis.fetch;

  return async function socksFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL(input.url);
    const isHttps = url.protocol === "https:";

    const options: http.RequestOptions & https.RequestOptions = {
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
