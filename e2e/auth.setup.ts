import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate with demo credentials", async ({ page }) => {
  await page.goto("/login");

  await page.fill("#username", "demo@shanxiang.ai");
  await page.fill("#password", "demo123");
  await page.click('button:has-text("登录")');

  // Should redirect to workspace after login
  await page.waitForURL("/");
  await expect(page.locator("h1")).toContainText("工作台");

  await page.context().storageState({ path: authFile });
});
