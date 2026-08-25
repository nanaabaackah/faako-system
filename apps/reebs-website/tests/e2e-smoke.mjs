import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.REEBS_PREVIEW_URL || "http://127.0.0.1:4176";
const baseOrigin = new URL(baseUrl).origin;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const catalogue = JSON.parse(
  readFileSync(new URL("../src/content/public-catalogue.json", import.meta.url), "utf8"),
);
const firstRental = catalogue.rentals[0];
const firstShopItem = catalogue.shop[0];
const screenshotDir = process.env.REEBS_E2E_SCREENSHOT_DIR
  ? resolve(process.env.REEBS_E2E_SCREENSHOT_DIR)
  : "";
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const routeScreenshotNames = new Map([
  ["/", "01-home.png"],
  ["/shop", "02-shop.png"],
  [firstShopItem.path, "03-product.png"],
  [firstRental.path, "04-rental-detail.png"],
  ["/checkout", "06-checkout.png"],
  ["/contact", "07-contact.png"],
  ["/customer-login", "08-customer-login.png"],
]);
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
  if (message.type() === "error") {
    const source = message.location().url;
    if (source && new URL(source).origin !== baseOrigin) return;
    pageErrors.push(`${activeRoute}: ${message.text()}${source ? ` (${source})` : ""}`);
  }
});
page.on("response", (response) => {
  const responseUrl = new URL(response.url());
  if (responseUrl.origin !== baseOrigin) return;
  const pathname = responseUrl.pathname.toLowerCase();
  if (
    response.status() >= 400
    && !pathname.endsWith("/authsession")
    && !pathname.endsWith("/v1/auth/session")
  ) {
    pageErrors.push(`${activeRoute}: HTTP ${response.status()} ${response.url()}`);
  }
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
  if (url.pathname.endsWith("/authSession") || requestPath.endsWith("/v1/auth/session")) {
    await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    await route.fulfill({ status: 200, json: [] });
    return;
  }
  if (url.origin !== baseOrigin) {
    await route.abort();
    return;
  }
  await route.continue();
});

const defaultCoreStorefrontRoutes = [
  "/",
  "/about",
  "/book",
  "/cart",
  "/checkout",
  "/contact",
  "/customer-login",
  "/delivery-policy",
  "/faq",
  "/privacy-policy",
  "/refund-policy",
  "/rentals",
  firstRental.path,
  "/shop",
  firstShopItem.path,
  "/terms-of-service",
];
const routeOverride = String(process.env.REEBS_E2E_ROUTE || "").trim();
const coreStorefrontRoutes = routeOverride
  ? routeOverride.split(",").map((route) => route.trim()).filter(Boolean)
  : defaultCoreStorefrontRoutes;

for (const route of coreStorefrontRoutes) {
  activeRoute = route;
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response?.status(), 200, route);
  await page.waitForFunction(
      () => Array.from(document.querySelectorAll("astro-island"))
        .every((island) => !island.hasAttribute("ssr")),
      undefined,
      { timeout: 15_000 },
    )
    .catch(async (error) => {
      const pendingIslands = await page.locator("astro-island[ssr]").evaluateAll((islands) =>
        islands.map((island) => island.getAttribute("component-url") || island.outerHTML.slice(0, 120)),
      );
      throw new Error(
        `${route} did not finish hydrating: ${error.message}\nPending: ${pendingIslands.join(", ")}\nBrowser errors:\n${pageErrors.join("\n") || "(none)"}`,
      );
    });
  // Let React flush recoverable hydration diagnostics before the next hard
  // navigation so any failure is attributed to the route that caused it.
  await page.waitForTimeout(250);
  assert.equal(await page.locator("h1").count(), 1, `${route} h1`);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    true,
    `${route} horizontal overflow`,
  );
  assert.equal(
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(".main");
      if (!(scrollContainer instanceof HTMLElement)) return true;
      return getComputedStyle(scrollContainer).overflowX !== "auto"
        && getComputedStyle(scrollContainer).overflowX !== "scroll";
    }),
    true,
    `${route} internal horizontal scrolling`,
  );
  assert.ok(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    `${route} canonical`,
  );
  const screenshotName = routeScreenshotNames.get(route);
  if (screenshotDir && screenshotName) {
    await page.screenshot({ path: join(screenshotDir, screenshotName), fullPage: false });
  }
}

if (!routeOverride) {
  activeRoute = "all rental detail pages with API fallback";
  for (const rental of catalogue.rentals) {
    const response = await page.goto(`${baseUrl}${rental.path}`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response?.status(), 200, rental.path);
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("astro-island"))
        .every((island) => !island.hasAttribute("ssr")),
      undefined,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(150);
    assert.equal(
      await page.getByRole("heading", { level: 1, name: rental.name }).count(),
      1,
      `${rental.path} rental heading`,
    );
    assert.equal(
      await page.getByText("We couldn’t find that rental.", { exact: true }).count(),
      0,
      `${rental.path} lost its pre-rendered fallback`,
    );
    const bookingHref = await page.getByRole("link", { name: "Book this rental" }).getAttribute("href");
    assert.ok(bookingHref?.startsWith("/book?rental="), `${rental.path} booking href`);
  }

  activeRoute = "status pages";
  for (const statusRoute of ["/404", "/500"]) {
    const response = await page.goto(`${baseUrl}${statusRoute}`, {
      waitUntil: "domcontentloaded",
    });
    // Some static preview servers serve explicit /404 and /500 documents with
    // status 200. Validate the generated page content and recovery actions; the
    // deployment adapter remains responsible for the production HTTP status.
    assert.ok(
      [200, Number(statusRoute.slice(1))].includes(response?.status() || 0),
      `${statusRoute} response`,
    );
    assert.equal(await page.locator("h1").count(), 1, `${statusRoute} h1`);
    assert.ok(await page.locator(".status-actions a").count() >= 2, `${statusRoute} actions`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
      `${statusRoute} horizontal overflow`,
    );
  }

  activeRoute = "/ mobile navigation";
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open menu" }).click();
  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, "04-mobile-menu.png"), fullPage: false });
  }
  for (const destination of ["/", "/shop", "/rentals", "/book", "/contact"]) {
    assert.equal(
      await page.locator(`.navbar-mobile-panel a[href="${destination}"]`).count(),
      1,
      `mobile navigation missing ${destination}`,
    );
  }
  assert.equal(
    await page.locator('.navbar-mobile-panel a[href="/about"]').count(),
    0,
    "About must not appear in mobile navigation",
  );

  activeRoute = "/shop cart interaction";
  await page.evaluate(() => window.localStorage.removeItem("cart"));
  await page.goto(`${baseUrl}/shop`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("astro-island"))
      .every((island) => !island.hasAttribute("ssr")),
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForFunction(() => window.localStorage.getItem("cart") !== null);
  await page
    .getByText(firstShopItem.name, { exact: true })
    .first()
    .waitFor()
    .catch((error) => {
      throw new Error(
        `${error.message}\nBrowser errors:\n${pageErrors.join("\n") || "(none)"}`,
      );
  });
  const firstShopCard = page.locator("article").filter({
    has: page.getByText(firstShopItem.name, { exact: true }),
  }).first();
  await firstShopCard.getByRole("button", { name: "Add to cart" }).click();
  await page.waitForFunction(
    (itemName) => {
      try {
        const storedCart = JSON.parse(window.localStorage.getItem("cart") || "[]");
        return Array.isArray(storedCart) && storedCart.some((item) => item?.name === itemName);
      } catch {
        return false;
      }
    },
    firstShopItem.name,
  );
  activeRoute = "/cart";
  await page.goto(`${baseUrl}/cart`, { waitUntil: "domcontentloaded" });
  await page.getByText(firstShopItem.name, { exact: true }).first().waitFor();
  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, "05-cart.png"), fullPage: false });
  }

  activeRoute = "/shop scroll reveal";
  await page.goto(`${baseUrl}/shop`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelectorAll(".js-observed-reveal").length > 0,
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".js-observed-reveal.is-visible").length > 0,
    undefined,
    { timeout: 15_000 },
  );
  const scrollRevealState = await page.evaluate(async () => {
    const scrollContainer = document.querySelector(".main");
    if (!(scrollContainer instanceof HTMLElement)) return null;
    const initialVisible = document.querySelectorAll(".js-observed-reveal.is-visible").length;
    scrollContainer.scrollTo({ top: 900, behavior: "instant" });
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    const down = {
      top: scrollContainer.scrollTop,
      visible: document.querySelectorAll(".js-observed-reveal.is-visible").length,
    };
    scrollContainer.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    return {
      initialVisible,
      down,
      up: {
        top: scrollContainer.scrollTop,
        visible: document.querySelectorAll(".js-observed-reveal.is-visible").length,
      },
    };
  });
  assert.ok(scrollRevealState?.down.top > 0, "Shop scroll reveal did not scroll down");
  assert.ok(scrollRevealState?.initialVisible > 0, "Shop scroll reveal has no visible targets");
  assert.equal(scrollRevealState?.up.top, 0, "Shop scroll reveal did not return upward");

  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktopPage.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== baseOrigin) {
      await route.abort();
      return;
    }
    const requestPath = url.pathname.toLowerCase();
    if (/\/inventory\/?$/.test(requestPath)) {
      await route.fulfill({ status: 200, json: liveInventory });
      return;
    }
    if (requestPath.startsWith("/api/")) {
      await route.fulfill({ status: 200, json: [] });
      return;
    }
    await route.continue();
  });
  for (const route of ["/shop", "/rentals", firstShopItem.path]) {
    const response = await desktopPage.goto(`${baseUrl}${route}`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response?.status(), 200, `${route} desktop`);
    assert.equal(
      await desktopPage.evaluate(() => {
        const scrollContainer = document.querySelector(".main");
        if (!(scrollContainer instanceof HTMLElement)) return true;
        const overflowX = getComputedStyle(scrollContainer).overflowX;
        return ["clip", "hidden"].includes(overflowX)
          && scrollContainer.scrollWidth <= scrollContainer.clientWidth;
      }),
      true,
      `${route} desktop internal horizontal overflow`,
    );
  }
  await desktopPage.close();

  const reducedMotionContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const reducedMotionPage = await reducedMotionContext.newPage();
  await reducedMotionPage.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== baseOrigin) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await reducedMotionPage.goto(`${baseUrl}/shop`, { waitUntil: "domcontentloaded" });
  await reducedMotionPage.waitForTimeout(700);
  assert.equal(
    await reducedMotionPage.locator(".js-observed-reveal").evaluateAll((nodes) =>
      nodes.filter((node) => getComputedStyle(node).opacity !== "1").length,
    ),
    0,
    "reduced motion must not hide reveal content",
  );
  await reducedMotionContext.close();
}

assert.deepEqual(pageErrors, [], `browser errors:\n${pageErrors.join("\n")}`);
await browser.close();
console.log("REEBS Astro browser smoke checks passed.");
