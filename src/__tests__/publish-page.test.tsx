import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import { I18nProvider } from "@/components/i18n-provider";
import { NextRequest } from "next/server";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj_lotion" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import PublishPage from "@/app/(dashboard)/projects/[id]/publish/page";
import { GET as shopifyStart } from "@/app/api/auth/shopify/route";
import { ConnectButton } from "@/components/integrations/connect-button";

const posted: unknown[] = [];

function project() {
  return {
    id: "proj_lotion",
    title: "乳液",
    status: "GENERATED",
    generatedImages: [{
      id: "gen_1",
      url: "https://cdn.example/gen.png",
      s3Key: "generated/gen.png",
      createdAt: "2026-11-20T00:00:00.000Z",
      status: "SUCCEEDED",
      productImageId: "src_1",
    }],
  };
}

describe("publish page paths", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let connected = false;

  beforeEach(() => {
    posted.length = 0;
    connected = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/products/proj_lotion")) return Response.json({ project: project() });
      if (url.endsWith("/api/publish") && (!init?.method || init.method === "GET")) {
        return Response.json({ shopifyConnected: connected, shopName: connected ? "mystore" : null });
      }
      if (url.endsWith("/api/publish") && init?.method === "POST") {
        posted.push(JSON.parse(String(init.body)));
        return Response.json({ results: [{ platform: "SHOPIFY", status: "published", postUrl: "https://admin.shopify.com/store/mystore/products/1" }] });
      }
      return new Response("not found", { status: 404 });
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    vi.unstubAllGlobals();
  });

  async function waitFor(text: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if ((container?.textContent ?? "").includes(text)) return;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
    throw new Error(container?.textContent ?? "missing");
  }

  function render() {
    act(() => {
      root?.render(
        <I18nProvider locale="zh" messages={zh}>
          <PublishPage />
        </I18nProvider>,
      );
    });
  }

  it("sends a disconnected store to the integrations page through a real link", async () => {
    connected = false;
    render();
    await waitFor("Shopify");
    const link = container?.querySelector("[data-testid='connect-shopify']") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/integrations");
    expect(link.querySelector("button")).toBeNull();
    expect(container?.querySelector("[data-testid='publish-submit']")).toBeNull();
  });

  it("posts the selected image when a store is already connected", async () => {
    connected = true;
    render();
    await waitFor("发布");
    expect(container?.querySelector("[data-testid='connect-shopify']")).toBeNull();
    const image = container?.querySelector("button img") as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("/api/generated-images/gen_1/file");
    (image.closest("button") as HTMLButtonElement).click();
    await act(async () => {
      await Promise.resolve();
    });
    const submit = container?.querySelector("[data-testid='publish-submit']") as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    submit.click();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(posted[0]).toMatchObject({
      imageProjectId: "proj_lotion",
      generatedImageIds: ["gen_1"],
      platforms: ["SHOPIFY"],
    });
  });

  it("continues from integrations into the Shopify authorize redirect", async () => {
    act(() => {
      root?.render(
        <I18nProvider locale="zh" messages={zh}>
          <ConnectButton platform="SHOPIFY" platformName="Shopify" userId="user_1" needsShopName />
        </I18nProvider>,
      );
    });
    const open = [...(container?.querySelectorAll("button") ?? [])].find((node) => node.textContent?.includes("Shopify"));
    open?.click();
    await act(async () => {
      await Promise.resolve();
    });
    const input = container?.querySelector("input") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "mystore.myshopify.com");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const go = container?.querySelector("a") as HTMLAnchorElement;
    expect(go.getAttribute("href")).toBe("/api/auth/shopify?shop=mystore.myshopify.com&userId=user_1");
    expect(go.querySelector("button")).toBeNull();

    process.env.SHOPIFY_CLIENT_ID = "cid_test";
    const res = await shopifyStart(new NextRequest("https://flashant.test/api/auth/shopify?shop=mystore.myshopify.com&userId=user_1"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("https://mystore.myshopify.com/admin/oauth/authorize");
    expect(location).toContain("client_id=cid_test");
    delete process.env.SHOPIFY_CLIENT_ID;
  });
});
