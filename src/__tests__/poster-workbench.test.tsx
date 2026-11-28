import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";
import { I18nProvider } from "@/components/i18n-provider";
import { StudioDetailPanel } from "@/components/studio/detail-panel";

describe("poster workbench fields", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/generated-images/") && url.endsWith("/poster")) {
        return new Response(JSON.stringify({
          poster: { id: "poster_1", url: "https://cdn.example/poster.png", sourceId: "gen_1", market: "en", template: "B" },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/api/generate")) {
        return new Response(JSON.stringify({
          generated: [{ key: "selling_points", url: "https://cdn.example/original.png", id: "gen_1", unlettered: true }],
          posters: [],
          posterFailed: [],
          failed: [],
          requested: 1,
          completed: 1,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  async function render(node: ReactNode) {
    await act(async () => { root?.render(node); });
  }

  async function openPack() {
    const button = [...(container?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.includes("详情图"));
    if (!button) throw new Error("pack panel toggle not found");
    await act(async () => { button.click(); });
  }

  function input(testId: string): HTMLInputElement {
    const node = container?.querySelector(`[data-testid="${testId}"]`);
    if (!(node instanceof HTMLInputElement)) throw new Error(`missing ${testId}`);
    return node;
  }

  it("starts empty, keeps typed copy when the language changes, and sends that copy", async () => {
    await render(
      <I18nProvider locale="zh" messages={zh}>
        <StudioDetailPanel projectId="proj-poster" productImageId="img-1" basePrompt="soft light" />
      </I18nProvider>,
    );
    await openPack();
    const toggle = input("poster-toggle");
    expect(toggle.checked).toBe(false);
    await act(async () => { toggle.click(); });
    const title = input("poster-title");
    const series = input("poster-series");
    expect(title.value).toBe("");
    expect(series.value).toBe("");
    expect(title.placeholder).toBe(zh.studio.poster.titlePlaceholder);
    expect(title.value).not.toBe(title.placeholder);

    const typed = "我的商品标题";
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(title, typed);
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input("poster-title").value).toBe(typed);

    const language = container?.querySelector("[data-testid='poster-language']");
    if (!(language instanceof HTMLSelectElement)) throw new Error("language select missing");
    expect([...language.options].map((option) => option.value)).toEqual(["zh", "en", "ja", "ko"]);
    await act(async () => {
      language.value = "en";
      language.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(input("poster-title").value).toBe(typed);
    expect(input("poster-series").value).toBe("");

    const generate = [...(container?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.includes("生成"));
    if (!generate) throw new Error("generate button missing");
    await act(async () => { generate.click(); });

    const generateCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/generate"));
    expect(generateCall).toBeTruthy();
    const body = JSON.parse(String(generateCall?.[1]?.body));
    expect(body.poster).toMatchObject({
      enabled: true,
      market: "en",
      copy: { title: typed, series: "", dek: "" },
    });
    expect(JSON.stringify(body.detailTypes)).not.toContain(typed);
    expect(JSON.stringify(body)).not.toContain("磨砂圆柱瓶身");
    expect(en.studio.poster.fieldTitle).toBe("Title");
    expect(zh.studio.poster.fieldTitle).toBe("标题");
  });
});
