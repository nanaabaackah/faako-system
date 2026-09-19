import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(
  readFileSync(new URL("../src/content/public-catalogue.json", import.meta.url), "utf8"),
);
const rentalDetailPath = catalogue.rentals[0].path;
const shopDetailPath = catalogue.shop[0].path;

const products = [
  {
    id: 1,
    name: "Rainbow Balloon Set",
    specificCategory: "Party Supplies",
    sourceCategoryCode: "INVENTORY",
    price: 50,
    quantity: 4,
    description: "Colorful balloons",
    image: "/imgs/placeholder.png",
  },
  {
    id: 101,
    name: "Mini Bouncy Castle",
    specificCategory: "Kid Bouncers",
    sourceCategoryCode: "RENTAL",
    price: 700,
    rate: "per day",
    quantity: 2,
    status: true,
    image: "/imgs/placeholder.png",
    page: "/rentals/mini-bouncy-castle",
  },
];

const routes = [
  "/",
  "/about",
  "/shop",
  shopDetailPath,
  "/rentals",
  rentalDetailPath,
  "/book",
  "/cart",
  "/checkout",
  "/customer-login",
  "/reset-password",
  "/contact",
  "/faq",
  "/delivery-policy",
  "/privacy-policy",
  "/refund-policy",
  "/terms-of-service",
  "/missing-page",
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const payload = pathname.endsWith("/inventory") ? products : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  await page.route("**/v6.exchangerate-api.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: "success", conversion_rates: { GHS: 1 } }),
    })
  );
  await page.addInitScript(() => sessionStorage.setItem("popupShown", "true"));
});

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`storefront routes fit the ${width}px viewport`, async ({ page }) => {
    // The first development-server pass compiles more than 1,000 generated
    // catalogue routes, so leave enough time for a cold local cache.
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });

    for (const route of routes) {
      await test.step(route, async () => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main")).toBeVisible({ timeout: 25_000 });
        const overflow = await page.evaluate(() => ({
          html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
          main: (() => {
            const main = document.querySelector(".main");
            return main ? main.scrollWidth - main.clientWidth : 0;
          })(),
        }));
        expect(overflow.html, `${route} html overflow at ${width}px`).toBeLessThanOrEqual(1);
        expect(overflow.body, `${route} body overflow at ${width}px`).toBeLessThanOrEqual(1);
        expect(overflow.main, `${route} scroll-host overflow at ${width}px`).toBeLessThanOrEqual(1);
      });
    }
  });
}

test("mobile navigation and search remain keyboard-operable", async ({ page }) => {
  // Cold Astro development builds generate more than 1,000 catalogue routes.
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveClass(/is-open/);
  await page.getByRole("button", { name: "Open site search" }).first().click();
  const searchDialog = page.getByRole("dialog", { name: "Find pages, rentals, and shop" });
  await expect(searchDialog).toBeVisible();
  await expect(page.getByLabel("Search the site")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchDialog).toBeHidden();
});

test("critical React islands hydrate without server/client mismatches", async ({ page }) => {
  test.setTimeout(150_000);
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration failed|server rendered html didn't match/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });

  for (const route of ["/", "/about", "/shop", "/rentals", "/book", "/checkout"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
  }

  expect(hydrationErrors).toEqual([]);
});

test("unknown storefront URLs render a useful 404 page", async ({ page }) => {
  await page.goto("/missing-page");
  await expect(page.getByRole("heading", { name: /not at this address/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /browse shop/i })).toBeVisible();
});

test("critical storefront pages have no serious or critical axe violations", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ["/", "/shop", rentalDetailPath, "/book", "/checkout", "/missing-page"]) {
    await test.step(route, async () => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible({ timeout: 25_000 });
      await injectAxe(page);
      const violations = await getViolations(page);
      const blocking = violations.filter((violation) =>
        violation.impact === "serious" || violation.impact === "critical"
      );
      expect(
        blocking.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
        })),
        `${route} serious/critical accessibility violations`,
      ).toEqual([]);
    });
  }
});
