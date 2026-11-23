import { describe, expect, it } from "vitest";
import {
  applyAuthBaseUrl,
  authActionUrl,
  chooseAuthOrigin,
  resolveAuthRedirect,
} from "@/lib/auth-base-url";

const deployment = "https://flashant.vercel.app";
const custom = "https://flashant.cn";
const www = "https://www.flashant.cn";

describe("auth base URL", () => {
  it("keeps provider and callback URLs on the custom domain when the deployment host is also configured", () => {
    const origin = chooseAuthOrigin({
      env: {
        NEXTAUTH_URL: deployment,
        NEXT_PUBLIC_APP_URL: custom,
      },
      forwardedHost: "flashant.cn",
      forwardedProto: "https",
      requestUrl: `${deployment}/api/auth/providers`,
    });
    expect(origin).toBe(custom);
    expect(authActionUrl(origin!, "signin")).toBe(`${custom}/api/auth/signin/credentials`);
    expect(authActionUrl(origin!, "callback")).toBe(`${custom}/api/auth/callback/credentials`);
    expect(authActionUrl(origin!, "callback")).not.toContain("vercel.app");
  });

  it("keeps www on www and does not fall back to the deployment host", () => {
    const origin = chooseAuthOrigin({
      env: { AUTH_URL: deployment, NEXTAUTH_URL: deployment },
      forwardedHost: "www.flashant.cn",
      forwardedProto: "https",
      requestUrl: `${deployment}/api/auth/callback/credentials`,
    });
    expect(origin).toBe(www);
    expect(authActionUrl(origin!, "callback")).not.toContain("vercel.app");
  });

  it("prefers an explicit custom AUTH_URL over a deployment NEXTAUTH_URL", () => {
    expect(chooseAuthOrigin({
      env: { AUTH_URL: custom, NEXTAUTH_URL: deployment },
      forwardedHost: "flashant.vercel.app",
      forwardedProto: "https",
      requestUrl: `${deployment}/api/auth/providers`,
    })).toBe(custom);
  });

  it("prefers a custom public app URL when every auth URL is the deployment host", () => {
    const env = {
      AUTH_URL: deployment,
      NEXTAUTH_URL: `${deployment}/`,
      NEXT_PUBLIC_APP_URL: custom,
    };
    expect(applyAuthBaseUrl(env)).toBe(custom);
    expect(env.AUTH_URL).toBe(custom);
    expect(env.NEXTAUTH_URL).toBeUndefined();
    expect(env.AUTH_URL).not.toContain("vercel.app");
  });

  it("leaves a custom NEXTAUTH_URL in place", () => {
    const env = { NEXTAUTH_URL: custom, NEXT_PUBLIC_APP_URL: "http://localhost:3000" };
    expect(applyAuthBaseUrl(env)).toBe(custom);
    expect(env.NEXTAUTH_URL).toBe(custom);
    expect(env.AUTH_URL).toBeUndefined();
  });

  it("removes a deployment-host auth URL and does not invent one when no custom origin is configured", () => {
    const env = { NEXTAUTH_URL: deployment };
    expect(applyAuthBaseUrl(env)).toBeNull();
    expect(env.NEXTAUTH_URL).toBeUndefined();
    expect(env.AUTH_URL).toBeUndefined();
    expect(chooseAuthOrigin({
      env,
      forwardedHost: "flashant.cn",
      forwardedProto: "https",
      requestUrl: `${deployment}/login`,
    })).toBe(custom);
  });

  it("does not let a deployment base URL replace a custom-domain callback", () => {
    expect(resolveAuthRedirect(`${custom}/login`, deployment)).toBe(`${custom}/login`);
    expect(resolveAuthRedirect("/dashboard", custom)).toBe(`${custom}/dashboard`);
    expect(resolveAuthRedirect(`${custom}/dashboard`, custom)).toBe(`${custom}/dashboard`);
    expect(resolveAuthRedirect("https://evil.example/phish", custom)).toBe(custom);
    expect(resolveAuthRedirect(`${www}/login`, deployment)).toBe(`${www}/login`);
    expect(resolveAuthRedirect(`${www}/login`, deployment)).not.toContain("vercel.app");
  });
});
