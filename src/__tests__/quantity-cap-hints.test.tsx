import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";
import { I18nProvider } from "@/components/i18n-provider";
import { QuantitySlider } from "@/components/product/quantity-slider";
import { StudioDetailPanel } from "@/components/studio/detail-panel";

const PACK_CONFIRMATION = "将生成 {count} 张套图，消耗 {count} 点额度。失败的图片会退回额度。";

function confirmation(count: number) {
  return PACK_CONFIRMATION.replaceAll("{count}", String(count));
}

describe("generation quantity hints", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    localStorage.clear();
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
    localStorage.clear();
  });

  async function render(node: ReactNode) {
    await act(async () => {
      root?.render(node);
    });
  }

  function text() {
    return container?.textContent ?? "";
  }

  async function clickButton(label: string) {
    const button = [...(container?.querySelectorAll("button") ?? [])].find(
      (item) => item.textContent?.trim() === label,
    );
    if (!button) throw new Error(`button not found: ${label}`);
    await act(async () => {
      button.click();
    });
  }

  async function openPack(locale: "zh" | "en") {
    const label = locale === "zh" ? "详情图" : "Detail Images";
    const button = [...(container?.querySelectorAll("button") ?? [])].find((item) =>
      item.textContent?.includes(label),
    );
    if (!button) throw new Error("pack panel toggle not found");
    await act(async () => {
      button.click();
    });
  }

  async function selectRemainingPackTypes() {
    const targets = [...(container?.querySelectorAll("button") ?? [])].filter(
      (button) => button.textContent?.trim() === "全选",
    );
    await act(async () => {
      for (const button of targets) button.click();
    });
  }

  async function renderPack(locale: "zh" | "en") {
    const messages = locale === "zh" ? zh : en;
    await render(
      <I18nProvider locale={locale} messages={messages}>
        <StudioDetailPanel projectId="proj-hints" productImageId="img-1" basePrompt="silver earrings" />
      </I18nProvider>,
    );
    await openPack(locale);
  }

  it("shows the pack cap hint before extra types are selected, and the all-14 line only at 14", async () => {
    await renderPack("zh");

    const hint = container?.querySelector("[data-testid='pack-run-hint']")?.textContent ?? "";
    expect(hint).toContain("本类推荐一次生成 4 张");
    expect(hint).toContain("一共 14 种");
    expect(hint).toContain("项目不限总张数");
    expect(hint).toContain("以账户剩余额度为准");
    expect(hint).toContain("成功一张扣一点，失败退回");
    expect(text()).not.toContain("已选全部 14 种，本次按 14 张生成。");
    expect(text()).toContain(confirmation(4));

    await clickButton("美妆护肤");

    const categoryHint = container?.querySelector("[data-testid='pack-run-hint']")?.textContent ?? "";
    expect(categoryHint).toContain("本类推荐一次生成 6 张");
    expect(categoryHint).toContain("一共 14 种");
    expect(categoryHint).toContain("项目不限总张数");
    expect(categoryHint).toContain("以账户剩余额度为准");
    expect(text()).toContain("推荐套图 · 美妆护肤 · 6 张");
    expect(text()).toContain(confirmation(6));
    expect(container?.querySelector("[data-testid='pack-all-selected']")).toBeNull();

    await selectRemainingPackTypes();

    expect(container?.querySelector("[data-testid='pack-all-selected']")?.textContent).toBe(
      "已选全部 14 种，本次按 14 张生成。",
    );
    expect(text()).toContain(confirmation(14));
    expect(text()).toContain("本类推荐一次生成 6 张");
  });

  it("shows the English pack hint with the category size and keeps the per-run confirmation", async () => {
    await renderPack("en");
    await clickButton("服饰配饰");

    const hint = container?.querySelector("[data-testid='pack-run-hint']")?.textContent ?? "";
    expect(hint).toContain("This category’s recommended pack is 6 images");
    expect(hint).toContain("up to 14 in total");
    expect(hint).toContain("There is no project-wide image cap");
    expect(hint).toContain("remaining monthly credits");
    expect(hint).toContain("1 credit per successful image, refunded on failure");
    expect(container?.querySelector("[data-testid='pack-all-selected']")).toBeNull();
    expect(text()).toContain("推荐套图 · 服饰配饰 · 6 张");
    expect(text()).toContain(confirmation(6));

    await selectRemainingPackTypes();
    expect(container?.querySelector("[data-testid='pack-all-selected']")?.textContent).toBe(
      "All 14 types are selected; this run will generate 14 images.",
    );
    expect(text()).toContain(confirmation(14));
  });

  it("shows the per-run max of 8, a maximum end label, and chargePreview for the chosen quantity", async () => {
    await render(
      <I18nProvider locale="zh" messages={zh}>
        <QuantitySlider value={4} onChange={() => {}} />
      </I18nProvider>,
    );

    expect(container?.querySelector("[data-testid='quantity-run-cap']")?.textContent).toBe(
      "一次最多生成 8 张，将消耗相应点数。",
    );
    expect(container?.querySelector("[data-testid='quantity-max-end']")?.textContent).toBe("最多 8 张");
    expect(container?.querySelector("[data-testid='quantity-max-end']")?.textContent).not.toBe("8");
    expect(container?.querySelector("[data-testid='quantity-charge-preview']")?.textContent).toBe(
      "本次生成 4 张，消耗 4 点额度",
    );

    await render(
      <I18nProvider locale="zh" messages={zh}>
        <QuantitySlider value={8} onChange={() => {}} />
      </I18nProvider>,
    );
    expect(container?.querySelector("[data-testid='quantity-charge-preview']")?.textContent).toBe(
      "本次生成 8 张，消耗 8 点额度",
    );

    await render(
      <I18nProvider locale="en" messages={en}>
        <QuantitySlider value={2} onChange={() => {}} />
      </I18nProvider>,
    );

    expect(container?.querySelector("[data-testid='quantity-run-cap']")?.textContent).toBe(
      "Up to 8 images per run, charged per image.",
    );
    expect(container?.querySelector("[data-testid='quantity-max-end']")?.textContent).toBe("Up to 8 images");
    expect(container?.querySelector("[data-testid='quantity-charge-preview']")?.textContent).toBe(
      "This run creates 2 images and charges 2 credits.",
    );

    await render(
      <I18nProvider locale="en" messages={en}>
        <QuantitySlider value={6} onChange={() => {}} />
      </I18nProvider>,
    );
    expect(container?.querySelector("[data-testid='quantity-charge-preview']")?.textContent).toBe(
      "This run creates 6 images and charges 6 credits.",
    );
  });
});
