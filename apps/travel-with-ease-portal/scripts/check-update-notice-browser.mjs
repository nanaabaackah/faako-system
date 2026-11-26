import { navigateWorkspace } from "./navigate-workspace.mjs";
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
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="faako-app" content="travel-with-ease-cms"><script type="module" src="/assets/update-fixture-' + version + '.js"></script></head><body></body></html>' });
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator(".session-toolbar").waitFor();
    const navigate = name => navigateWorkspace(page, name);
    // Hold the first CMS save until the update notice is visible. A failed
    // acknowledgement must also keep the current draft protected.
    let failSave = true;
    await page.route("**/api/agent/content/home/draft", async route => {
      if (!failSave) return route.fallback();
      await new Promise(resolve => setTimeout(resolve, 800));
      return route.fulfill({ status: 503, json: { ok:false, error:{ code:"service_unavailable", message:"Synthetic save failure" } } });
    });
    await navigate("Content");
    const draftHeading = page.getByLabel(/^Heading/);
    await draftHeading.fill("Pending CMS draft fixture");
    version = 1;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const notice = page.getByRole("complementary", { name: "App update available" });
    const refresh = notice.getByRole("button", { name: "Refresh now" });
    await expect(refresh).toBeDisabled();
    await expect(page.getByText("Error — unsaved edits retained", {exact:true})).toBeVisible();
    await expect(refresh).toBeDisabled();
    await expect(draftHeading).toHaveValue("Pending CMS draft fixture");
    failSave = false;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(refresh).toBeEnabled();
    await notice.getByRole("button", { name: "Later" }).click();
    let failTemplateSave = true;
    await page.route("**/api/agent/templates/*/draft", async route => {
      if (!failTemplateSave) return route.fallback();
      return route.fulfill({ status: 503, json: { ok:false, error:{ code:"service_unavailable", message:"Synthetic template save failure" } } });
    });
    await navigate("Templates");
    const heading = page.getByLabel(/^Heading/);
    await heading.waitFor();
    await heading.fill("Pending template update fixture");
    version = 2;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(notice).toBeVisible();
    await expect(refresh).toBeDisabled();
    await expect(heading).toHaveValue("Pending template update fixture");
    await expect(page.getByText("Draft not saved", { exact: true })).toBeVisible();
    assert.equal(navigations, 1, "No automatic reload during an unsaved edit");
    await notice.getByRole("button", { name: "Later" }).click();
    await expect(notice).toHaveCount(0);
    await expect(heading).toHaveValue("Pending template update fixture");
    version = 3;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(notice).toBeVisible();
    await expect(refresh).toBeDisabled();
    failTemplateSave = false;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(refresh).toBeEnabled();
    await expect(heading).toHaveValue("Pending template update fixture");
    if (width <= 900) {
      const banner = await notice.boundingBox();
      const nav = await page.locator(".twe-bottom-nav").boundingBox();
      assert.ok(banner && nav && banner.y + banner.height <= nav.y, "Update prompt must not cover mobile navigation");
    }
    await Promise.all([page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() }), refresh.click()]);
    assert.equal(navigations, 2, "Only explicit refresh navigates");
    await context.close();
  }
  // At 02:00 UTC, apply a deferred deployment without requiring a click.
  // A dirty editor crossing the deadline must remain intact until saved.
  for (const dirtyAtDeadline of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "America/New_York" });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-11-24T01:55:00Z") });
    let updateAvailable = false, navigations = 0;
    let firstCheck = true, startInitialCheck, releaseInitialCheck;
    const initialCheckStarted = new Promise(resolve => { startInitialCheck = resolve; });
    const initialCheckReleased = new Promise(resolve => { releaseInitialCheck = resolve; });
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
    await mockWorkspaceApi(page, { role: "owner" });
    await page.route("**/?__faako_update_check=*", async route => {
      if (firstCheck) {
        firstCheck = false;
        const oldShell = await route.fetch();
        startInitialCheck();
        await initialCheckReleased;
        return route.fulfill({ response: oldShell });
      }
      if (!updateAvailable) return route.continue();
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="faako-app" content="travel-with-ease-cms"><script type="module" src="/assets/daily-update-fixture.js"></script></head><body></body></html>' });
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator(".session-toolbar").waitFor();
    await initialCheckStarted;
    let failTemplateSave = dirtyAtDeadline;
    await page.route("**/api/agent/templates/*/draft", async route => {
      if (!failTemplateSave) return route.fallback();
      return route.fulfill({ status: 503, json: { ok:false, error:{ code:"service_unavailable", message:"Synthetic template save failure" } } });
    });
    if (dirtyAtDeadline) {
      await navigateWorkspace(page, "Templates");
      await page.getByLabel(/^Heading/).fill("Keep this edit across the deadline");
      await page.clock.runFor(1500);
      await expect(page.getByText("Draft not saved", { exact: true })).toBeVisible();
    }
    updateAvailable = true;
    // Force a foreground check while the startup request still holds the old shell.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    releaseInitialCheck();
    const notice = page.getByRole("complementary", { name: "App update available" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Later" }).click();
    await expect(notice).toHaveCount(0);
    await page.clock.fastForward(4 * 60_000);
    assert.equal(navigations, 1, "No scheduled reload before 02:00 UTC");
    if (dirtyAtDeadline) {
      await page.clock.fastForward(2 * 60_000);
      assert.equal(navigations, 1, "Unsaved work blocks the overnight refresh");
      await expect(page.getByLabel(/^Heading/)).toHaveValue("Keep this edit across the deadline");
      failTemplateSave = false;
      await Promise.all([
        page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() }),
        page.getByRole("button", { name: "Save draft", exact: true }).click(),
      ]);
    } else {
      await Promise.all([
        page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() }),
        page.clock.fastForward(2 * 60_000),
      ]);
    }
    assert.equal(navigations, 2, "Apply a pending deployment once when due and safe");
    await context.close();
  }
  console.log("Update notice: guarded edits, save, defer, explicit refresh and 02:00 UTC fallback passed");
} finally { await browser.close(); }
