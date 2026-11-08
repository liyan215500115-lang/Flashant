import { expect, test } from "@playwright/test";

test.describe("homepage category mix", () => {
  test("style tabs switch the first image, and the slider stays Chanel", async ({ page }) => {
    await page.context().addCookies([
      { name: "NEXT_LOCALE", value: "en", url: "http://localhost:3000" },
    ]);
    await page.goto("/");

    const panel = page.locator("[data-style-key]");
    const material = page.getByRole("tab", { name: "Material" });
    const lifestyle = page.getByRole("tab", { name: "Lifestyle" });
    const scene = page.getByRole("tab", { name: "Scene" });

    await expect(material).toHaveAttribute("aria-pressed", "true");
    await expect(lifestyle).toHaveAttribute("aria-pressed", "false");
    await expect(panel).toHaveAttribute("data-style-key", "material");
    await expect(panel.locator("img").first()).toHaveAttribute(
      "src",
      /sku-b-omega-watch\.webp$/,
    );

    await lifestyle.click();
    await expect(lifestyle).toHaveAttribute("aria-pressed", "true");
    await expect(material).toHaveAttribute("aria-pressed", "false");
    await expect(panel).toHaveAttribute("data-style-key", "lifestyle");
    await expect(panel.locator("img").first()).toHaveAttribute(
      "src",
      /sku-c-bo-speaker\.webp$/,
    );

    await scene.click();
    await expect(scene).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toHaveAttribute("data-style-key", "scene");
    await expect(panel.locator("img").nth(0)).toHaveAttribute(
      "src",
      /sku-b-omega-watch\.webp$/,
    );
    await expect(panel.locator("img").nth(1)).toHaveAttribute(
      "src",
      /sku-c-bo-speaker\.webp$/,
    );

    const slider = page.locator("section").filter({ hasText: "Phone snap vs the result" });
    await expect(slider.locator("img").nth(0)).toHaveAttribute(
      "src",
      /slider-before-sku-a\.webp$/,
    );
    await expect(slider.locator("img").nth(1)).toHaveAttribute(
      "src",
      /slider-after-material\.webp$/,
    );
  });
});
