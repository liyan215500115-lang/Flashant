import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuotaRemainingBadge } from "@/components/project/quota-badge";

describe("quota remaining badge", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
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
  });

  function render(
    status: "loading" | "ready" | "error",
    value: string,
    copy: { label: string; retryLabel: string } = { label: "本月剩余", retryLabel: "重新读取" },
  ) {
    const onRetry = vi.fn();
    act(() => {
      root?.render(
        <QuotaRemainingBadge
          label={copy.label}
          status={status}
          value={value}
          retryLabel={copy.retryLabel}
          exhausted={false}
          onRetry={onRetry}
        />,
      );
    });
    return onRetry;
  }

  it("shows the confirmed remaining balance without clipping the figures", () => {
    render("ready", "96/100");
    const badge = container?.querySelector("[data-testid='quota-badge']");
    const value = container?.querySelector("[data-testid='quota-value']");
    expect(container?.textContent).toContain("本月剩余");
    expect(value?.textContent).toBe("96/100");
    expect(container?.querySelector("[data-testid='quota-retry']")).toBeNull();
    expect(container?.textContent).not.toContain("…");
    expect(badge?.className).toContain("whitespace-nowrap");
    expect(badge?.className).toContain("min-w-[13em]");
    expect(badge?.className).not.toMatch(/truncate|ellipsis/);
    expect(value?.className).toContain("tabular-nums");
  });

  it("shows a fixed slot while loading and does not show a balance or an ellipsis", () => {
    render("loading", "…");
    const badge = container?.querySelector("[data-testid='quota-badge']");
    expect(container?.querySelector("[data-testid='quota-skel']")).not.toBeNull();
    expect(container?.querySelector("[data-testid='quota-value']")).toBeNull();
    expect(container?.textContent).not.toContain("0/0");
    expect(container?.textContent).not.toContain("…");
    expect(container?.textContent).not.toContain("无限");
    expect(badge?.className).toContain("whitespace-nowrap");
    expect(badge?.className).toContain("min-w-[13em]");
    expect(badge?.className).not.toMatch(/truncate|ellipsis/);
    expect(badge?.className).not.toContain("overflow-hidden");
  });

  it("shows the month label, an em dash, and a reload button after a failed load", () => {
    const onRetry = render("error", "0/0");
    const text = container?.textContent ?? "";
    expect(text).toBe("本月剩余 — 重新读取");
    expect(text).not.toContain("剩余额度加载失败");
    expect(text).not.toContain("0/0");
    expect(text).not.toContain("…");
    expect(text).not.toContain("无限");
    expect(text).not.toMatch(/unlimited|∞/i);
    const retry = container?.querySelector("[data-testid='quota-retry']");
    expect(retry?.tagName).toBe("BUTTON");
    expect(retry?.textContent).toBe("重新读取");
    act(() => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    render("error", "0/0", { label: "Remaining this month", retryLabel: "Reload" });
    const english = container?.textContent ?? "";
    expect(english).toBe("Remaining this month — Reload");
    expect(english).not.toContain("Couldn't load remaining quota");
    expect(english).not.toContain("0/0");
  });
});
