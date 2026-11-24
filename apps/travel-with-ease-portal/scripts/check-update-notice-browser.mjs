// The deployed-bundle change is simulated at the same-origin HTML boundary.
import { mockWorkspaceApi } from "../test/fixtures/browser-api.js";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../stroane-web/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const origin = process.env.TWE_TEST_PORTAL_ORIGIN || "http://127.0.0.1:5197";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let version = 0, navigations = 0;
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
    await mockWorkspaceApi(page, { role: "owner" });
    await page.route("**/?__faako_update_check=*", async route => {
      if (!version) return route.continue();
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><script type="module" src="/assets/update-fixture-' + version + '.js"></script></head><body></body></html>' });
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator(".session-toolbar").waitFor();
    const navigate = async name => {
      let button = page.getByRole("button", { name, exact: true }).filter({visible:true}).first();
      if (!await button.count()) {
        await page.getByRole("button", { name: /^Menu/ }).click();
        button = page.getByRole("button", { name, exact: true }).filter({visible:true}).first();
      }
      await button.click();
    };
    await navigate("Templates");
    const heading = page.getByLabel(/^Heading/);
    await heading.waitFor();
    await heading.fill("Pending template update fixture");
    version = 1;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const notice = page.getByRole("complementary", { name: "App update available" });
    const refresh = notice.getByRole("button", { name: "Refresh now" });
    await expect(notice).toBeVisible();
    await expect(refresh).toBeDisabled();
    await expect(heading).toHaveValue("Pending template update fixture");
    assert.equal(navigations, 1, "No automatic reload during an unsaved edit");
    await notice.getByRole("button", { name: "Later" }).click();
    await expect(notice).toHaveCount(0);
    await expect(heading).toHaveValue("Pending template update fixture");
    version = 2;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(notice).toBeVisible();
    await expect(refresh).toBeDisabled();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(refresh).toBeEnabled();
    await expect(heading).toHaveValue("Pending template update fixture");
    if (width <= 800) {
      const banner = await notice.boundingBox();
      const nav = await page.locator(".twe-bottom-nav").boundingBox();
      assert.ok(banner && nav && banner.y + banner.height <= nav.y, "Update prompt must not cover mobile navigation");
    }
    await Promise.all([page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() }), refresh.click()]);
    assert.equal(navigations, 2, "Only explicit refresh navigates");
    await context.close();
  }
  console.log("Update notice: guarded edits, save, defer and explicit refresh passed");
} finally { await browser.close(); }
