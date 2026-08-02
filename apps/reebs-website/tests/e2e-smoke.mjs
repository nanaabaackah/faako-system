import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.REEBS_PREVIEW_URL || "http://127.0.0.1:4176";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const catalogue = JSON.parse(
  readFileSync(new URL("../src/content/public-catalogue.json", import.meta.url), "utf8"),
);
const firstRental = catalogue.rentals[0];
const firstShopItem = catalogue.shop[0];
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const pageErrors = [];
let activeRoute = "browser startup";

page.on("pageerror", (error) => pageErrors.push(`${activeRoute}: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`${activeRoute}: ${message.text()}`);
});

const liveInventory = [
  {
    ...firstRental,
    sourceCategoryCode: "RENTAL",
    specificCategory: firstRental.category,
    quantity: 1,
    status: true,
  },
  {
    ...firstShopItem,
    sourceCategoryCode: "PARTY",
    specificCategory: firstShopItem.category,
    quantity: 5,
    status: true,
  },
];

await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  const requestPath = url.pathname.toLowerCase();
  if (/\/inventorycounts\/?$/.test(requestPath)) {
    await route.fulfill({
      status: 200,
      json: { products: 1, rentals: 1, bookings: 0 },
    });
    return;
  }
  if (/\/inventory\/?$/.test(requestPath)) {
    await route.fulfill({ status: 200, json: liveInventory });
    return;
  }
  if (url.pathname.endsWith("/authSession")) {
    await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    await route.fulfill({ status: 200, json: [] });
    return;
  }
  await route.continue();
});

for (const route of ["/", "/shop", firstShopItem.path, "/rentals", firstRental.path]) {
  activeRoute = route;
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response?.status(), 200, route);
  assert.equal(await page.locator("h1").count(), 1, `${route} h1`);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    true,
    `${route} horizontal overflow`,
  );
  assert.ok(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    `${route} canonical`,
  );
}

activeRoute = "/shop cart interaction";
await page.goto(`${baseUrl}/shop`, { waitUntil: "domcontentloaded" });
await page
  .getByText(firstShopItem.name, { exact: true })
  .first()
  .waitFor()
  .catch((error) => {
    throw new Error(
      `${error.message}\nBrowser errors:\n${pageErrors.join("\n") || "(none)"}`,
    );
  });
await page.getByRole("button", { name: "Add to cart" }).first().click();
activeRoute = "/cart";
await page.goto(`${baseUrl}/cart`, { waitUntil: "domcontentloaded" });
await page.getByText(firstShopItem.name, { exact: true }).first().waitFor();

assert.deepEqual(pageErrors, [], `browser errors:\n${pageErrors.join("\n")}`);
await browser.close();
console.log("REEBS Astro browser smoke checks passed.");
