import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";
import { I18nProvider } from "@/components/i18n-provider";
import type { JsonMessage } from "@/lib/translate";

const downloadUrls = vi.hoisted(() => vi.fn(async () => ({ failed: 0, total: 1 })));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/download-image", () => ({
  downloadUrls,
  downloadBlob: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj_lotion" }),
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

import ProductDetailPage from "@/app/(dashboard)/projects/[id]/page";

const QUOTA_OK = {
  used: 62,
  limit: 100,
  allowed: true,
  balance: 38,
  tier: "PRO",
  allotmentConfigured: true,
  quotaKnown: true,
};

function project(options: {
  originals?: number;
  generated?: number;
  title?: string;
}) {
  const originals = options.originals ?? 1;
  const generated = options.generated ?? 2;
  return {
    id: "proj_lotion",
    title: options.title ?? "乳液",
    status: generated > 0 ? "GENERATED" : "DRAFT",
    errorMessage: null,
    promptTemplate: null,
    tasks: [],
    productImages: Array.from({ length: originals }, (_, index) => ({
      id: `src_${index + 1}`,
      originalUrl: `https://cdn.example/source-${index + 1}.png`,
      fileName: `source-${index + 1}.png`,
      mimeType: "image/png",
    })),
    generatedImages: Array.from({ length: generated }, (_, index) => ({
      id: `gen_${index + 1}`,
      productImageId: "src_1",
      url: `https://cdn.example/gen-${index + 1}.png`,
      s3Key: `generated/gen-${index + 1}.png`,
      status: "SUCCEEDED",
      promptUsed: "soft light",
      errorMessage: null,
      createdAt: "2026-11-20T00:00:00.000Z",
    })),
  };
}

describe("project detail page paths", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let quotaOpen = true;

  beforeEach(() => {
    downloadUrls.mockClear();
    downloadUrls.mockResolvedValue({ failed: 0, total: 1 });
    push.mockClear();
    quotaOpen = true;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/quota")) {
        if (!quotaOpen) return new Response("no", { status: 500 });
        return Response.json(QUOTA_OK);
      }
      if (url.includes("/api/products/proj_lotion") && (!init?.method || init.method === "GET")) {
        return Response.json({ project: currentProject });
      }
      if (url.includes("/api/products/proj_lotion") && init?.method === "DELETE") {
        return Response.json({ ok: true });
      }
      if (url.includes("/images") && init?.method === "DELETE") {
        return Response.json({ ok: true });
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
    root = null;
    container = null;
    vi.unstubAllGlobals();
  });

  let currentProject = project({});

  function render(messages: JsonMessage = zh) {
    act(() => {
      root?.render(
        <I18nProvider locale={messages === en ? "en" : "zh"} messages={messages}>
          <ProductDetailPage />
        </I18nProvider>,
      );
    });
  }

  async function waitFor(predicate: () => boolean) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (predicate()) return;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }
    throw new Error(container?.textContent ?? document.body.textContent ?? "not found");
  }

  function button(testId: string) {
    return container?.querySelector(`[data-testid='${testId}']`) as HTMLButtonElement | HTMLAnchorElement | null;
  }

  it("wires back, quota, download, publish, studio, select, and per-image actions", async () => {
    currentProject = project({ originals: 1, generated: 2 });
    render();
    await waitFor(() => (container?.textContent ?? "").includes("38/100"));

    const back = button("back-to-projects");
    expect(back?.tagName).toBe("A");
    expect(back?.getAttribute("href")).toBe("/projects");
    expect(back?.querySelector("button")).toBeNull();

    const quota = container?.querySelector("[data-testid='quota-badge']");
    expect(quota?.textContent).toContain("本月剩余");
    expect(quota?.textContent).toContain("38/100");
    expect(quota?.className).toContain("whitespace-nowrap");
    expect(quota?.className).not.toMatch(/truncate|ellipsis/);
    expect(container?.querySelector("h1")?.contains(quota as Node)).toBe(false);
    expect(container?.querySelector("[data-testid='status-pill']")?.textContent).toBe("已生成");
    expect(container?.querySelector("[data-testid='shot-count']")?.textContent).toBe("2 张");
    expect(container?.querySelector("[data-testid='shot-sub']")?.textContent).toContain("另有 1 张原图");
    expect(container?.textContent).not.toContain("全部生成完成");
    expect(container?.textContent).not.toContain("全部完成");

    const download = button("action-download") as HTMLButtonElement;
    const publish = button("action-publish");
    const studio = [...(container?.querySelectorAll("[data-studio='true']") ?? [])];
    expect(download.disabled).toBe(false);
    expect(download.getAttribute("data-emphasis")).toBe("primary");
    expect(publish?.tagName).toBe("A");
    expect(publish?.getAttribute("href")).toBe("/projects/proj_lotion/publish");
    expect(publish?.querySelector("button")).toBeNull();
    expect(studio.length).toBeGreaterThan(0);
    for (const link of studio) {
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("href")).toBe("/studio?projectId=proj_lotion");
      expect(link.querySelector("button")).toBeNull();
    }
    expect(container?.querySelector("[data-testid='action-studio']")?.getAttribute("data-emphasis")).toBeNull();

    download.click();
    await act(async () => {
      await Promise.resolve();
    });
    expect(downloadUrls).toHaveBeenCalledTimes(1);
    const batch = downloadUrls.mock.calls[0][0] as { url: string }[];
    expect(batch.map((item) => item.url)).toEqual([
      "/api/generated-images/gen_1/file",
      "/api/generated-images/gen_2/file",
    ]);

    downloadUrls.mockClear();
    const perImage = [...(container?.querySelectorAll("[data-kind='generated'] [data-testid='shot-download']") ?? [])] as HTMLButtonElement[];
    expect(perImage).toHaveLength(2);
    perImage[0].click();
    perImage[1].click();
    await act(async () => {
      await Promise.resolve();
    });
    expect(downloadUrls.mock.calls.map((call) => call[0][0].url)).toEqual([
      "/api/generated-images/gen_1/file",
      "/api/generated-images/gen_2/file",
    ]);

    const edit = container?.querySelector("[data-kind='generated'] [data-testid='shot-edit']") as HTMLButtonElement;
    expect(edit.tagName).toBe("BUTTON");
    expect(edit.getAttribute("title")).toContain("不会打开工作室");
    edit.click();
    await waitFor(() => /编辑图片|加载中|图片加载失败/.test(document.body.textContent ?? ""));
    expect(push).not.toHaveBeenCalled();

    (container?.querySelector("[data-testid='shot-delete']") as HTMLButtonElement).click();
    await waitFor(() => (document.body.textContent ?? "").includes("删除"));

    (button("action-select") as HTMLButtonElement).click();
    await waitFor(() => button("action-done") !== null);
    expect(container?.querySelector("[data-testid='quota-badge']")).not.toBeNull();
    expect(container?.querySelector("[data-testid='project-toolbar'] [data-testid='quota-badge']")).toBeNull();
    expect(container?.querySelector("[data-testid='shot-edit']")).toBeNull();
    expect(container?.querySelector("[data-testid='gallery-continue']")).toBeNull();

    await act(async () => {
      (container?.querySelector("[data-testid='shot-open']") as HTMLButtonElement).click();
    });
    const batchDelete = button("action-batch-delete") as HTMLButtonElement;
    expect(batchDelete.disabled).toBe(false);
    batchDelete.click();
    await waitFor(() => (document.body.textContent ?? "").includes("删除"));

    (button("action-done") as HTMLButtonElement).click();
    await waitFor(() => button("action-download") !== null);
    expect(button("action-done")).toBeNull();
  });

  it("reloads a failed quota without showing 0/0 or unlimited", async () => {
    currentProject = project({});
    quotaOpen = false;
    render();
    await waitFor(() => (container?.textContent ?? "").includes("本月剩余 — 重新读取"));
    expect(container?.textContent).not.toContain("0/0");
    expect(container?.textContent).not.toMatch(/无限|unlimited/);
    const retry = container?.querySelector("[data-testid='quota-retry']") as HTMLButtonElement;
    expect(retry.tagName).toBe("BUTTON");
    quotaOpen = true;
    retry.click();
    await waitFor(() => (container?.textContent ?? "").includes("38/100"));
    expect(container?.textContent).not.toContain("重新读取");
  });

  it("uses the locked English quota failure copy", async () => {
    currentProject = project({});
    quotaOpen = false;
    render(en);
    await waitFor(() => (container?.textContent ?? "").includes("Remaining this month — Reload"));
    expect(container?.textContent).not.toContain("0/0");
  });

  it("disables download, publish, and select on an empty project and still deletes it", async () => {
    currentProject = project({ originals: 0, generated: 0 });
    render();
    await waitFor(() => (container?.textContent ?? "").includes("还没有成片"));
    const download = button("action-download") as HTMLButtonElement;
    const publish = button("action-publish") as HTMLButtonElement;
    const select = button("action-select") as HTMLButtonElement;
    const remove = button("action-delete") as HTMLButtonElement;
    expect(download.disabled).toBe(true);
    expect(publish.tagName).toBe("BUTTON");
    expect(publish.disabled).toBe(true);
    expect(publish.hasAttribute("href")).toBe(false);
    expect(select.disabled).toBe(true);
    expect(remove.disabled).toBe(false);
    expect(button("action-studio")?.getAttribute("data-emphasis")).toBe("primary");
    expect(button("action-studio")?.getAttribute("href")).toBe("/studio?projectId=proj_lotion");
    expect(container?.querySelector("[data-testid='gallery-empty-title']")?.textContent).toBe("还没有成片");
    expect(container?.querySelector("[data-testid='gallery-empty-studio']")?.getAttribute("href")).toBe("/studio?projectId=proj_lotion");
    expect(container?.querySelector("[data-testid='status-pill']")?.textContent).toBe("未生成");
    expect(container?.querySelector("[data-testid='shot']")).toBeNull();

    downloadUrls.mockClear();
    download.click();
    publish.click();
    select.click();
    expect(downloadUrls).not.toHaveBeenCalled();
    expect(button("action-done")).toBeNull();
    expect(publish.getAttribute("href")).toBeNull();

    remove.click();
    await waitFor(() => (document.body.textContent ?? "").includes("确认删除"));
  });

  it("keeps select and delete usable when only the original exists", async () => {
    currentProject = project({ originals: 1, generated: 0 });
    render();
    await waitFor(() => (container?.textContent ?? "").includes("已有 1 张原图"));
    const download = button("action-download") as HTMLButtonElement;
    const publish = button("action-publish") as HTMLButtonElement;
    const select = button("action-select") as HTMLButtonElement;
    expect(download.disabled).toBe(true);
    expect(publish.disabled).toBe(true);
    expect(select.disabled).toBe(false);
    expect((button("action-delete") as HTMLButtonElement).disabled).toBe(false);
    expect(button("action-studio")?.getAttribute("data-emphasis")).toBe("primary");
    expect(container?.querySelector("[data-testid='shot-count']")?.textContent).toBe("0 张");
    expect(container?.querySelector("[data-testid='status-pill']")?.textContent).toBe("未生成");
    expect(container?.querySelectorAll("[data-testid='shot']")).toHaveLength(1);
    download.click();
    expect(downloadUrls).not.toHaveBeenCalled();
    select.click();
    await waitFor(() => button("action-done") !== null);
  });
});
