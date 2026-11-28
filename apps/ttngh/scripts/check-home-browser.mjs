import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { localTestServer } from "./local-test-server.mjs";

const server = await localTestServer();
const screenshotDir = process.env.TTNGH_HOME_SCREENSHOTS;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });

try {
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await page.route("https://**/*", route => route.abort());
    await page.goto(server.origin + "/", { waitUntil: "domcontentloaded" });
    const consent = page.locator("[data-cookie-essential]");
    if (await consent.isVisible()) await consent.click();
    await page.locator("main img").evaluateAll(images => images.forEach(image => {
      if (new URL(image.src).origin === location.origin) image.loading = "eager";
    }));
    await page.waitForFunction(() => [...document.querySelectorAll("main img")].filter(image => new URL(image.src).origin === location.origin).every(image => image.complete && image.naturalWidth > 0));
    await page.locator("main img").evaluateAll(images => Promise.all(images.filter(image => new URL(image.src).origin === location.origin).map(image => image.decode())));

    assert.equal(await page.locator("main h1").count(), 1, `home H1 at ${width}px`);
    assert.equal(await page.locator("#milestones-title").count(), 1, `milestones heading at ${width}px`);
    assert.equal(await page.locator(".home-milestone-list li").count(), 4, `milestones at ${width}px`);
    assert.equal(await page.getByRole("heading", { name: "Latest news from TTNGH" }).count(), 1, `news heading at ${width}px`);
    assert.equal(await page.getByRole("heading", { name: "Practical mental health resources" }).count(), 1, `resources heading at ${width}px`);
    const publicationCards = await page.locator(".home-publications :is(.content-entry,.news-card)").count();
    const publicationFallbacks = await page.locator(".home-publication-empty").count();
    assert.ok(publicationCards >= 1, `published homepage content at ${width}px`);
    assert.equal(publicationCards + publicationFallbacks >= 2, true, `populated or empty publication sections at ${width}px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `home overflow at ${width}px`);
    assert.equal(await page.locator('a[href="/impact#milestones-title"]').count(), 1, `milestone destination at ${width}px`);
    assert.equal(await page.locator('a[href="/news"]').count() > 0, true, `news destination at ${width}px`);
    assert.equal(await page.locator('a[href="/resources"]').count() > 0, true, `resource destination at ${width}px`);

    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/home-${width}.png`, fullPage: true, animations: "disabled" });
    await page.close();
  }
  console.log("Homepage milestones, news and resources passed at 390, 768 and 1440px.");
} finally {
  await browser.close();
  await server.close();
}
