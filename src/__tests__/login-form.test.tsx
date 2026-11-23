import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import { I18nProvider } from "@/components/i18n-provider";
import { POST_LOGIN_STUCK_MS } from "@/lib/credentials-login";

const submitCredentialsLogin = vi.hoisted(() => vi.fn());
const probeActiveSession = vi.hoisted(() => vi.fn(async () => false));

vi.mock("next/navigation", () => ({
  useRouter: () => {
    throw new Error("login must load the workbench with a full page navigation");
  },
}));

vi.mock("@/lib/credentials-login", async () => {
  const actual = await vi.importActual<typeof import("@/lib/credentials-login")>("@/lib/credentials-login");
  return {
    ...actual,
    submitCredentialsLogin,
    probeActiveSession,
  };
});

import { LoginForm } from "@/app/login/LoginForm";

const pageUrl = "https://flashant.cn/login?callbackUrl=/projects/abc";

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("login form", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let assign: ReturnType<typeof vi.fn>;
  let restoreLocation: (() => void) | null = null;

  beforeEach(() => {
    submitCredentialsLogin.mockReset();
    probeActiveSession.mockReset();
    probeActiveSession.mockResolvedValue(false);
    const previous = window.location;
    const parsed = new URL(pageUrl);
    assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign,
        origin: parsed.origin,
        href: parsed.href,
        search: parsed.search,
        pathname: parsed.pathname,
      },
    });
    restoreLocation = () => {
      Object.defineProperty(window, "location", { configurable: true, value: previous });
    };
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
    vi.useRealTimers();
  });

  async function renderForm() {
    await act(async () => {
      root?.render(
        <I18nProvider locale="zh" messages={zh}>
          <LoginForm />
        </I18nProvider>,
      );
    });
    const pending = probeActiveSession.mock.results.map((result) => result.value);
    await act(async () => {
      await Promise.all(pending);
    });
  }

  async function submit(email = "owner@example.com", password = "secret") {
    await renderForm();
    const emailInput = container?.querySelector<HTMLInputElement>("#email");
    const passwordInput = container?.querySelector<HTMLInputElement>("#password");
    const form = container?.querySelector("form");
    if (!emailInput || !passwordInput || !form) throw new Error("login form did not render");
    await act(async () => {
      setInput(emailInput, email);
      setInput(passwordInput, password);
    });
    await act(async () => {
      form.requestSubmit();
    });
  }

  function alertText() {
    return container?.querySelector("[role='alert']")?.textContent?.trim() ?? "";
  }

  function submitButton() {
    const button = container?.querySelector("button[type='submit']");
    if (!(button instanceof HTMLButtonElement)) throw new Error("missing submit button");
    return button;
  }

  function enterLink(href: string) {
    const link = container?.querySelector(`a[href='${href}']`);
    if (!(link instanceof HTMLAnchorElement)) throw new Error(`missing workbench link ${href}`);
    return link;
  }

  it("shows a timeout error instead of returning to 登录 with an empty alert", async () => {
    let finish: (value: { ok: false; reason: "network" }) => void = () => {};
    submitCredentialsLogin.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    await submit();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain("登录中...");
    expect(alertText()).toBe("");

    await act(async () => {
      finish({ ok: false, reason: "network" });
    });

    expect(alertText()).toBe("网络超时，请重试");
    expect(submitButton().disabled).toBe(false);
    expect(submitButton().textContent).toContain("登录");
    expect(submitButton().textContent).not.toContain("登录中...");
    expect(assign).not.toHaveBeenCalled();
    expect(container?.querySelector("a[href='/dashboard']")).toBeNull();
  });

  it("shows an invalid password on the form and does not open the workspace", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: false, reason: "credentials" });

    await submit();

    expect(alertText()).toBe("邮箱或密码错误");
    expect(submitButton().textContent).toContain("登录");
    expect(submitButton().disabled).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(container?.querySelector("a[href='/projects/abc']")).toBeNull();
    expect(container?.querySelector("a[href='/dashboard']")).toBeNull();
  });

  it("assigns the post-login path after a successful client submit", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: true, destination: "/projects/abc" });

    await submit();

    expect(submitCredentialsLogin).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "secret",
      callbackUrl: "/projects/abc",
      origin: "https://flashant.cn",
    });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/projects/abc");
    expect(String(assign.mock.calls[0][0])).not.toContain("vercel.app");
    expect(alertText()).toBe("已登录，正在进入工作台。");
    expect(alertText()).not.toContain("邮箱或密码错误");
    expect(enterLink("/projects/abc").textContent).toContain("进入工作台");
  });

  it("keeps a same-origin path when the callback points at the deployment host", async () => {
    submitCredentialsLogin.mockResolvedValue({
      ok: true,
      destination: "https://flashant.vercel.app/dashboard",
    });

    await submit();

    expect(assign).toHaveBeenCalledWith("/dashboard");
    expect(String(assign.mock.calls[0][0])).not.toContain("vercel.app");
    expect(enterLink("/dashboard").getAttribute("href")).toBe("/dashboard");
  });

  it("shows a retryable enter-workbench control when the page stays after assign", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    submitCredentialsLogin.mockResolvedValue({ ok: true, destination: "/dashboard" });

    await submit();

    expect(assign).toHaveBeenCalledWith("/dashboard");
    expect(alertText()).toBe("已登录，正在进入工作台。");
    expect(enterLink("/dashboard").textContent).toContain("进入工作台");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POST_LOGIN_STUCK_MS);
    });

    expect(alertText()).toBe("已登录，但工作台没有打开。请重试进入。");
    const link = enterLink("/dashboard");
    expect(link.textContent).toContain("进入工作台");
    expect(submitCredentialsLogin).toHaveBeenCalledTimes(1);

    await act(async () => {
      link.click();
    });
    expect(assign).toHaveBeenLastCalledWith("/dashboard");
    expect(assign.mock.calls.length).toBeGreaterThan(1);
    expect(assign.mock.calls.every((call) => String(call[0]) === "/dashboard")).toBe(true);
  });

  it("shows the enter-workbench control when assign throws and a click tries again", async () => {
    assign.mockImplementationOnce(() => {
      throw new Error("dashboard failed to load");
    });
    submitCredentialsLogin.mockResolvedValue({ ok: true, destination: "/dashboard" });

    await submit();

    expect(alertText()).toBe("已登录，但工作台没有打开。请重试进入。");
    const link = enterLink("/dashboard");
    expect(link.textContent).toContain("进入工作台");

    await act(async () => {
      link.click();
    });
    expect(assign).toHaveBeenLastCalledWith("/dashboard");
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it("shows a retryable enter-workbench control when a session already exists", async () => {
    probeActiveSession.mockResolvedValue(true);

    await renderForm();

    expect(submitCredentialsLogin).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(alertText()).toBe("已登录，但工作台没有打开。请重试进入。");
    const link = enterLink("/projects/abc");
    expect(link.textContent).toContain("进入工作台");

    await act(async () => {
      link.click();
    });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/projects/abc");
    expect(String(assign.mock.calls[0][0])).not.toContain("vercel.app");
  });
});
