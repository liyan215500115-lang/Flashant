import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import { I18nProvider } from "@/components/i18n-provider";
import { POST_LOGIN_STUCK_MS } from "@/lib/credentials-login";

const submitCredentialsLogin = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/credentials-login", async () => {
  const actual = await vi.importActual<typeof import("@/lib/credentials-login")>("@/lib/credentials-login");
  return {
    ...actual,
    submitCredentialsLogin,
  };
});

import { RegisterForm } from "@/app/register/RegisterForm";

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("register form", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let assign: ReturnType<typeof vi.fn>;
  let restoreLocation: (() => void) | null = null;

  beforeEach(() => {
    submitCredentialsLogin.mockReset();
    push.mockReset();
    const previous = window.location;
    assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign,
        origin: "https://flashant.cn",
        href: "https://flashant.cn/register",
        search: "",
        pathname: "/register",
      },
    });
    restoreLocation = () => {
      Object.defineProperty(window, "location", { configurable: true, value: previous });
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })),
    );
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
    restoreLocation?.();
    restoreLocation = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function renderForm() {
    await act(async () => {
      root?.render(
        <I18nProvider locale="zh" messages={zh}>
          <RegisterForm />
        </I18nProvider>,
      );
    });
  }

  async function submit() {
    await renderForm();
    const email = container?.querySelector<HTMLInputElement>("#email");
    const password = container?.querySelector<HTMLInputElement>("#password");
    const confirm = container?.querySelector<HTMLInputElement>("#confirm-password");
    const form = container?.querySelector("form");
    if (!email || !password || !confirm || !form) throw new Error("register form did not render");
    await act(async () => {
      setInput(email, "owner@example.com");
      setInput(password, "secret");
      setInput(confirm, "secret");
    });
    await act(async () => {
      form.requestSubmit();
    });
  }

  function alertText() {
    return container?.querySelector("[role='alert']")?.textContent?.trim() ?? "";
  }

  function enterLink(href = "/dashboard") {
    const link = container?.querySelector(`a[href='${href}']`);
    if (!(link instanceof HTMLAnchorElement)) throw new Error(`missing workbench link ${href}`);
    return link;
  }

  it("assigns the workbench after registration signs in", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: true, destination: "/dashboard" });

    await submit();

    expect(fetch).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({ method: "POST" }));
    expect(submitCredentialsLogin).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "secret",
      callbackUrl: "/dashboard",
      origin: "https://flashant.cn",
    });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/dashboard");
    expect(String(assign.mock.calls[0][0])).not.toContain("vercel.app");
    expect(push).not.toHaveBeenCalled();
    expect(alertText()).toBe("已登录，正在进入工作台。");
    expect(enterLink().textContent).toContain("进入工作台");
  });

  it("shows a retryable enter-workbench control when the workbench stays unloaded", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    submitCredentialsLogin.mockResolvedValue({ ok: true, destination: "/dashboard" });

    await submit();

    expect(assign).toHaveBeenCalledWith("/dashboard");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POST_LOGIN_STUCK_MS);
    });

    expect(alertText()).toBe("已登录，但工作台没有打开。请重试进入。");
    const link = enterLink();
    expect(link.textContent).toContain("进入工作台");

    await act(async () => {
      link.click();
    });
    expect(assign).toHaveBeenLastCalledWith("/dashboard");
    expect(assign.mock.calls.length).toBeGreaterThan(1);
  });

  it("does not open the workbench when the password is rejected", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: false, reason: "credentials" });

    await submit();

    expect(assign).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login?registered=1");
    expect(container?.querySelector("a[href='/dashboard']")).toBeNull();
    expect(alertText()).not.toContain("进入工作台");
  });

  it("shows the network error when auto-login times out", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: false, reason: "network" });

    await submit();

    expect(alertText()).toBe("网络超时，请重试");
    expect(assign).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(container?.querySelector("a[href='/dashboard']")).toBeNull();
  });
});
