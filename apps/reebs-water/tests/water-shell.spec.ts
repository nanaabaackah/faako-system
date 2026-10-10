import { expect, test } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

for (const theme of ["light", "dark"] as const) {
  test(`Water login fits 320px and uses ${theme} tokens, labels and keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.route(/^https?:\/\//, (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") return route.abort();
      if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 401, json: { error: "Authentication required" } });
      return route.continue();
    });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to Water" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-admin-theme", theme);
    await expect(page.locator("body")).toHaveCSS("color-scheme", theme);
    await expect(page.getByLabel("Email", { exact: true })).toHaveCSS("color", theme === "dark" ? "rgb(229, 231, 235)" : "rgb(17, 24, 39)");
    await page.getByLabel("Email", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await injectAxe(page);
    await checkA11y(page);
    await page.screenshot({ path: testInfo.outputPath(`water-login-${theme}.png`), fullPage: true });
  });
}
