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
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
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
  await expect(menuButton).toBeFocused();
  await menuButton.press("Enter");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveClass(/is-open/);
  await page.getByRole("button", { name: "Open site search" }).first().click();
  const searchDialog = page.getByRole("dialog", { name: "Find pages, rentals, and shop" });
  await expect(searchDialog).toBeVisible();
  await expect(page.getByLabel("Search the site")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchDialog).toBeHidden();
});

test("critical React islands hydrate without server/client mismatches", async ({ page }) => {
  // Six full navigations share this budget; cold compilation reached the final
  // route before exhausting 150s. Keep every hydration/error assertion intact.
  test.setTimeout(300_000);
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

test("catalogues stay browsable while shop and rental actions are disabled", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/shop", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
  await expect(page.getByRole("button", { name: "Online ordering unavailable" }).first()).toBeDisabled();
  await page.evaluate(() => sessionStorage.removeItem("reebs_inventory_cache_v2"));
  const inventoryResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/inventory"));
  await page.goto(rentalDetailPath, { waitUntil: "domcontentloaded" });
  await inventoryResponse;
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
  // The live fixture deliberately contains other rentals, not this published
  // detail. Hydration must not turn a valid static URL into a not-found page.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(catalogue.rentals[0].name);
  await expect(page.getByRole("button", { name: "Online booking unavailable" }).first()).toBeDisabled();
  for (const route of [rentalDetailPath, shopDetailPath]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    if (route === rentalDetailPath) {
      // Revisit with the inventory cache populated as well as the fresh request above.
      await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(catalogue.rentals[0].name);
      await expect(page.getByRole("button", { name: "Online booking unavailable" }).first()).toBeDisabled();
    }
    const products = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts.flatMap((script) => {
      const value = JSON.parse(script.textContent || "{}");
      return Array.isArray(value) ? value : value["@graph"] || [value];
    }).filter((value) => value["@type"] === "Product"));
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) expect(product.offers).toBeUndefined();
  }
});

test("critical storefront pages have no serious or critical axe violations", async ({ page }, testInfo) => {
  // Six navigations plus axe scans share this budget. Keep the same routes and
  // severity assertions while allowing a complete cold development-server pass.
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  // Scan the full, readable page rather than catching scroll-reveal text at
  // partial opacity. The viewport and keyboard tests retain normal motion.
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const route of ["/", "/shop", rentalDetailPath, "/book", "/checkout", "/missing-page"]) {
    await test.step(route, async () => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible({ timeout: 25_000 });
      await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
      // Audit the hydrated consent controls too, not only the initial Astro HTML.
      await expect(page.getByRole("region", { name: "Cookie settings", exact: true })).toBeVisible();
      if (route === "/") {
        await page.getByRole("region", { name: "Cookie settings", exact: true })
          .screenshot({ path: testInfo.outputPath("cookie-banner.png") });
      }
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
          details: violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
        })),
        `${route} serious/critical accessibility violations`,
      ).toEqual([]);
    });
  }
});
