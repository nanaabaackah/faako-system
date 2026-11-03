import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.TWE_TEST_WEB_ORIGIN || "http://127.0.0.1:4339";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local visual checks only");
const output = mkdtempSync(path.join(os.tmpdir(), "twe-journey-chapters-"));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const errors = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    for (const route of ["/", "/services", "/about", "/packages", "/journal", "/how-it-works", "/faqs", "/privacy"]) {
      const response = await page.goto(origin + route, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, route);
      const essential = page.getByRole("button", { name: "Essential only", exact: true });
      if (await essential.isVisible()) await essential.click();
      await page.evaluate(async () => {
        document.querySelectorAll("img").forEach(image => image.loading = "eager");
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
        await document.fonts.ready;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, route + " overflows " + width);
      assert.equal(await page.locator(".header-links").getByRole("link", { name: "Home", exact: true }).count(), 0);
      // Exclude Astro's development-toolbar shadow DOM from public landmarks.
      assert.equal(await page.locator("main h1").count(), 1, route + " needs one main heading");
      assert.equal(await page.locator(".cinematic-enquiry").count(), 1);
      assert.equal(await page.locator("footer.twe-public-footer").count(), 1);
      const closing = await page.locator(".closing-scene").evaluate(scene => {
        const image = scene.querySelector(".closing-scene__image");
        const bounds = image.getBoundingClientRect();
        const sceneBounds = scene.getBoundingClientRect();
        return {
          count: scene.querySelectorAll(".closing-scene__image").length,
          fit: getComputedStyle(image).objectFit,
          height: Math.abs(bounds.height - sceneBounds.height),
          width: Math.abs(bounds.width - sceneBounds.width),
          src: image.currentSrc,
          loaded: image.naturalWidth > 0,
        };
      });
      assert.equal(closing.count, 1);
      assert.equal(closing.fit, "cover");
      assert.ok(closing.height < 1 && closing.width < 1 && closing.loaded);
      if (width <= 760) assert.match(closing.src, /zanzibar-beach-club-b60ec1e6297a-1920\.webp/);
      if (route === "/") await page.locator(".closing-scene").screenshot({ path: path.join(output, `closing-${width}.png`) });
      assert.equal(await page.locator('img[src*="journey"], .service-panel img, .journey-process img').evaluateAll(images => images.every(image => image.naturalWidth > 0)), true);
      if (route === "/") {
        assert.equal(await page.locator(".service-panel").count(), 2);
        assert.equal(await page.getByRole("heading", { name: "Our travel footprint", exact: true }).count(), 1);
        assert.equal(await page.locator(".journey-process li").count(), 4);
        await page.locator(".home-journey-chapters").screenshot({ path: path.join(output, "chapters-" + width + ".png") });
      }
      if (route === "/services") assert.equal(await page.locator(".service-panel").count(), 4);
      if (route === "/packages") {
        const search = page.getByRole("searchbox", { name: "Search", exact: true });
        await search.waitFor();
        const input = await search.evaluate(element => ({
          border: getComputedStyle(element).borderWidth,
          paddingLeft: getComputedStyle(element).paddingLeft,
        }));
        assert.equal(input.border, "0px", "No nested input border");
        assert.equal(input.paddingLeft, "0px", "Wrapper owns the one input inset");
        if (width >= 901) {
          const sizes = await page.evaluate(() => ({
            search: document.querySelector(".collection-search").getBoundingClientRect().width,
            filter: document.querySelector(".collection-filter").getBoundingClientRect().width,
          }));
          assert.ok(sizes.search > sizes.filter);
        }
        await page.getByRole("button", { name: "Destination", exact: true }).click();
        const popup = page.locator(".ui-dropdown-field__popover");
        assert.equal(await popup.evaluate(e => getComputedStyle(e).backgroundColor), "rgb(244, 237, 227)");
        assert.equal(await popup.evaluate(e => getComputedStyle(e).backdropFilter), "none");
        await page.keyboard.press("Escape");
      }
      if (route === "/journal") {
        assert.ok(await page.locator(".journal-card").first().evaluate(e => e.getBoundingClientRect().width <= 361));
      }
      if (route === "/faqs") {
        const first = page.locator("details").first();
        await first.locator("summary").focus();
        await page.keyboard.press("Enter");
        assert.equal(await first.getAttribute("open"), "");
        await page.keyboard.press("Enter");
        assert.equal(await first.getAttribute("open"), null);
      }
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: path.join(output, (route === "/" ? "home" : route.slice(1)) + "-" + width + ".png") });
      }
      await page.evaluate(() => scrollTo(0, 650));
      await page.waitForFunction(() => document.querySelector(".site-header")?.classList.contains("is-scrolled"));
      const navigation = await page.locator(".site-header").evaluate(e => ({
        top: e.getBoundingClientRect().top,
        width: e.getBoundingClientRect().width,
        radius: getComputedStyle(e).borderRadius,
        pin: getComputedStyle(e.querySelector(".brand__pin")).display,
      }));
      assert.equal(navigation.radius, "25px");
      assert.ok(navigation.top >= 0 && navigation.top < 20);
      assert.ok(navigation.width < width);
      assert.equal(navigation.pin, "block");
      if (width <= 900) {
        await page.locator(".menu-toggle").click();
        assert.equal(await page.locator(".menu-toggle").getAttribute("aria-expanded"), "true");
        await page.getByRole("navigation", { name: "Primary navigation" }).press("Escape");
        assert.equal(await page.locator(".menu-toggle").getAttribute("aria-expanded"), "false");
      }
    }
    await page.goto(origin + "/", { waitUntil: "networkidle" });
    await page.locator(".service-panel").first().click({ position: { x: 24, y: 100 } });
    await page.waitForURL("**/services#service-2");
    const link = page.locator("#service-2 a").first();
    await link.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/services#plan");
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
  const page = await context.newPage();
  await page.goto(origin + "/");
  assert.equal(await page.locator(".service-panel a").count(), 2);
  assert.equal(await page.locator(".journey-process li").count(), 4);
  await page.goto(origin + "/faqs");
  await page.locator("details summary").first().click();
  assert.equal(await page.locator("details").first().getAttribute("open"), "");
  await context.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "passed", widths: [320, 390, 768, 1440], routes: 8, output, pageErrors: errors }));
} finally {
  await browser.close();
}
