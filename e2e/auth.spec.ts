import { test, expect } from "@playwright/test";

test.describe("authentication", () => {
  test("login page renders with form and branding", async ({ page }) => {
    await page.goto("/login");

    // Brand panel
    await expect(page.locator("text=闪象")).toBeVisible();
    await expect(page.locator("text=AI 商品图，一拍即发")).toBeVisible();

    // Login form
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });

  test("protected routes redirect to login when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });

  test("protected /products/new redirects to login", async ({ page }) => {
    await page.goto("/products/new");
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });

  test("protected /settings redirects to login", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });

  test("login with valid demo credentials succeeds", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#username", "demo@shanxiang.ai");
    await page.fill("#password", "demo123");
    await page.click('button:has-text("登录")');

    // Should redirect to the workspace
    await page.waitForURL("/");
    await expect(page.locator("h1")).toContainText("工作台");
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#username", "wrong@email.com");
    await page.fill("#password", "wrongpass");
    await page.click('button:has-text("登录")');

    // Should show error, stay on login page
    await expect(page.locator("text=用户名或密码错误")).toBeVisible();
    expect(page.url()).toContain("/login");
  });

  test("session persists after login", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#username", "demo@shanxiang.ai");
    await page.fill("#password", "demo123");
    await page.click('button:has-text("登录")');

    await page.waitForURL("/");
    expect(page.url()).toBe("http://localhost:3000/");

    // Navigate to a protected page — should stay authenticated
    await page.goto("/settings");
    await expect(page.locator("text=设置")).toBeVisible();
  });

  test("sign out redirects to login", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#username", "demo@shanxiang.ai");
    await page.fill("#password", "demo123");
    await page.click('button:has-text("登录")');
    await page.waitForURL("/");

    // Click sign out
    await page.click('button:has-text("退出登录")');

    // Should redirect to login
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });
});
