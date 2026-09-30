import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(readFileSync(new URL("../src/content/public-catalogue.json", import.meta.url), "utf8"));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("popupShown", "true"));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    return route.continue();
  });
});

for (const width of [320, 390, 768, 1280]) {
  test(`storefront cards and actions stay within their containers at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 844 });
    for (const [path, section] of [
      ["/shop", ".shop-empty"],
      [catalogue.rentals[0].path, ".rental-actions"],
      ["/contact", ".contact-info-grid"],
    ]) {
      await test.step(path, async () => {
        await page.goto(path, { waitUntil: "networkidle" });
        await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
        const reject = page.getByRole("button", { name: "Reject all", exact: true });
        if (await reject.isVisible()) await reject.click();
        if (path === "/shop") {
          // Astro may seed the catalogue before the mocked API returns. Exercise
          // the no-results state explicitly instead of relying on that race.
          await page.getByRole("searchbox", { name: "Search shop products" }).fill("no-such-product-mobile-layout-test");
        }
        const target = page.locator(section).first();
        await expect(target).toBeVisible();
        const overflow = await target.evaluate((parent) => {
          const box = parent.getBoundingClientRect();
          return [...parent.querySelectorAll("button, a, h2, p")].filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && (rect.left < Math.max(0, box.left) - 1 || rect.right > Math.min(innerWidth, box.right) + 1);
          }).map((element) => element.textContent?.trim());
        });
        expect(overflow, `${path}: no content hidden outside the card`).toEqual([]);
        if (path === "/contact") {
          const overlaps = await target.locator("a").evaluateAll((links) => {
            const pairs: string[] = [];
            links.forEach((a, index) => links.slice(index + 1).forEach((b) => {
              const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
              if (Math.min(x.right, y.right) > Math.max(x.left, y.left) + 1 && Math.min(x.bottom, y.bottom) > Math.max(x.top, y.top) + 1) pairs.push(`${a.textContent} / ${b.textContent}`);
            }));
            return pairs;
          });
          expect(overlaps).toEqual([]);
        }
        if (path.startsWith("/rentals/")) await expect(page.getByRole("button", { name: "Online booking unavailable" }).first()).toBeDisabled();
        await target.screenshot({ path: testInfo.outputPath(`${path === "/shop" ? "shop-empty" : path === "/contact" ? "contact-links" : "rental-actions"}-${width}.png`) });
      });
    }
  });
}
