import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import { I18nProvider } from "@/components/i18n-provider";

const submitCredentialsLogin = vi.hoisted(() => vi.fn());
const pushPostLoginRoute = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/credentials-login", () => ({
  submitCredentialsLogin,
  pushPostLoginRoute,
}));

import { LoginForm } from "@/app/login/LoginForm";

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("login form", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    submitCredentialsLogin.mockReset();
    pushPostLoginRoute.mockReset();
    push.mockReset();
    push.mockResolvedValue(undefined);
    pushPostLoginRoute.mockImplementation(async (navigate: (href: string) => unknown, href: string) => {
      try {
        await navigate(href);
        return true;
      } catch {
        return false;
      }
    });
    window.history.pushState({}, "", "/login?callbackUrl=/projects/abc");
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

  function renderForm() {
    act(() => {
      root?.render(
        <I18nProvider locale="zh" messages={zh}>
          <LoginForm />
        </I18nProvider>,
      );
    });
  }

  async function submit(email = "owner@example.com", password = "secret") {
    renderForm();
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
    const button = container?.querySelector("button[type='submit'], button[type='button']");
    if (!(button instanceof HTMLButtonElement)) throw new Error("missing submit button");
    return button;
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
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an invalid password on the form and does not open the workspace", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: false, reason: "credentials" });

    await submit();

    expect(alertText()).toBe("邮箱或密码错误");
    expect(submitButton().textContent).toContain("登录");
    expect(submitButton().disabled).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to the post-login route after a successful client submit", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: true, destination: "/projects/abc" });

    await submit();

    expect(submitCredentialsLogin).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "secret",
      callbackUrl: "/projects/abc",
      origin: window.location.origin,
    });
    expect(push).toHaveBeenCalledWith("/projects/abc");
    expect(alertText()).toContain("已登录");
    expect(alertText()).not.toContain("邮箱或密码错误");
  });

  it("keeps the session and lets the user retry when the workspace does not open", async () => {
    submitCredentialsLogin.mockResolvedValue({ ok: true, destination: "/dashboard" });
    push.mockRejectedValue(new Error("dashboard failed to load"));

    await submit();

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(alertText()).toBe("已登录，但工作台没有打开。请重试进入。");
    expect(submitButton().textContent).toContain("进入工作台");
    expect(submitButton().disabled).toBe(false);

    push.mockResolvedValue(undefined);
    await act(async () => {
      submitButton().click();
    });
    expect(push).toHaveBeenLastCalledWith("/dashboard");
    expect(submitCredentialsLogin).toHaveBeenCalledTimes(1);
  });
});
