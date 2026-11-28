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

  function render(status: "loading" | "ready" | "error", value: string) {
    const onRetry = vi.fn();
    act(() => {
      root?.render(
        <QuotaRemainingBadge
          label="本月剩余"
          status={status}
          value={value}
          errorLabel="剩余额度加载失败"
          retryLabel="重试"
          exhausted={false}
          onRetry={onRetry}
        />,
      );
    });
    return onRetry;
  }

  it("shows the confirmed remaining balance", () => {
    render("ready", "96/100");
    expect(container?.textContent).toContain("本月剩余");
    expect(container?.textContent).toContain("96/100");
    expect(container?.querySelector("[data-testid='quota-retry']")).toBeNull();
    expect(container?.textContent).not.toContain("…");
  });

  it("shows an ellipsis only while loading", () => {
    render("loading", "…");
    expect(container?.querySelector("[data-testid='quota-value']")?.textContent).toBe("…");
    expect(container?.textContent).not.toContain("0/0");
    expect(container?.textContent).not.toContain("无限");
  });

  it("ends a failed load on a retry message and never paints 0/0 or unlimited", () => {
    const onRetry = render("error", "0/0");
    const text = container?.textContent ?? "";
    expect(text).toContain("剩余额度加载失败");
    expect(text).toContain("重试");
    expect(text).not.toContain("0/0");
    expect(text).not.toContain("…");
    expect(text).not.toContain("无限");
    expect(text).not.toMatch(/unlimited|∞/i);
    const retry = container?.querySelector("[data-testid='quota-retry']");
    expect(retry?.tagName).toBe("BUTTON");
    act(() => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
