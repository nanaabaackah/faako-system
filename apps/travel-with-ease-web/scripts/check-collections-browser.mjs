// Actual Astro templates and Faako controls; synthetic local content only.
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../stroane-web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await mkdtemp(path.join(tmpdir(), "twe-collections-"));
const origin = process.env.TWE_TEST_WEB_ORIGIN || "http://127.0.0.1:4361";
assert.equal(new URL(origin).hostname, "127.0.0.1");
let server, browser, logs = "";
try {
  if (!process.env.TWE_TEST_WEB_ORIGIN) {
    server = spawn(process.execPath, ["--input-type=module", "-e", 'import { dev } from "astro"; await dev({ root: process.cwd(), server: { host: "127.0.0.1", port: 4361 }, devToolbar: { enabled: false } });'], {
      cwd, detached: true, env: { ...process.env, PUBLIC_APP_ENV: "development", TWE_CONTENT_SNAPSHOT: "", ASTRO_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", chunk => { logs += chunk; });
    server.stderr.on("data", chunk => { logs += chunk; });
  }
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* owned server starting */ }
    if (i === 59) throw new Error(logs.slice(-2000));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", hasTouch: width < 768 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + "/demo/packages", { waitUntil: "networkidle" });
    const consent = page.getByRole("button", { name: "Essential only", exact: true });
    if (await consent.isVisible()) await consent.click();
    await page.getByRole("status").filter({ hasText: "2 entries shown" }).waitFor();
    await page.getByRole("button", { name: "Destination", exact: true }).click();
    await page.getByRole("option", { name: "Kenya", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "1 entry shown" }).waitFor();
    assert.equal(await page.locator("[data-collection-item]:visible").count(), 1);
    await page.getByRole("searchbox", { name: "Search", exact: true }).fill("no-matching-synthetic-item");
    await page.getByText("No entries match. Clear the filters to see everything.", { exact: true }).waitFor();
    await page.getByRole("searchbox", { name: "Search", exact: true }).fill("");
    await page.getByRole("button", { name: "Destination", exact: true }).click();
    await page.getByRole("option", { name: "All", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "2 entries shown" }).waitFor();
    await page.screenshot({ path: path.join(output, `packages-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: "A slower rhythm in Zanzibar", exact: true }).click();
    await page.waitForURL("**/demo/packages/zanzibar-sample-journey");
    await page.getByRole("heading", { name: "A slower rhythm in Zanzibar", exact: true }).waitFor();
    assert.match(page.url(), /\/demo\/packages\/zanzibar-sample-journey$/);
    const itinerary = page.locator("details").first();
    await itinerary.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await itinerary.getAttribute("open"), "");
    const firstPhoto = page.locator("[data-gallery-index]").first();
    await page.locator('[data-image-gallery][data-gallery-ready="true"]').waitFor();
    await firstPhoto.click();
    await page.getByRole("dialog", { name: "Photo gallery", exact: true }).waitFor();
    await page.keyboard.press("ArrowRight");
    await page.getByText("Photo 2 of 2", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await firstPhoto.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `package-detail-${width}.png`), fullPage: true });
    await page.goto(origin + "/demo/journal", { waitUntil: "networkidle" });
    await page.getByRole("status").filter({ hasText: "2 entries shown" }).waitFor();
    await page.getByRole("button", { name: "Category", exact: true }).click();
    await page.getByRole("option", { name: "Travel guides", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "1 entry shown" }).waitFor();
    await page.screenshot({ path: path.join(output, `journal-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: "A little preparation, a clearer plan", exact: true }).click();
    await page.getByRole("heading", { name: "A little preparation, a clearer plan", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `journal-detail-${width}.png`), fullPage: true });
    await page.goto(origin + "/packages", { waitUntil: "networkidle" });
    const publicConsent = page.getByRole("button", { name: "Essential only", exact: true });
    if (await publicConsent.isVisible()) await publicConsent.click();
    await page.getByRole("status").filter({ hasText: "4 entries shown" }).waitFor();
    assert.equal(await page.locator("[data-collection-item]").count(), 4);
    assert.equal(await page.locator("[data-collection-item] > .placed-image > img").count(), 4);
    const fieldStyle = await page.getByRole("button", { name: "Destination", exact: true }).evaluate(element => {
      const style = getComputedStyle(element);
      return { border: parseFloat(style.borderTopWidth), font: parseFloat(style.fontSize) };
    });
    assert.ok(fieldStyle.border >= 1);
    assert.ok(fieldStyle.font >= 16);
    assert.equal(await page.locator(".closing-scene").count(), 1);
    assert.equal(await page.locator(".cinematic-enquiry").count(), 1);
    assert.equal(await page.locator("footer.twe-public-footer").count(), 1);
    assert.equal(await page.locator(".closing-scene__image").evaluate(element => getComputedStyle(element).objectFit),
      "cover");
    await page.getByRole("button", { name: "Occasion", exact: true }).click();
    await page.getByRole("option", { name: "Family", exact: true }).click();
    await page.getByText("No entries match. Clear the filters to see everything.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Occasion", exact: true }).click();
    await page.getByRole("option", { name: "All occasions", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "4 entries shown" }).waitFor();
    await page.screenshot({ path: path.join(output, `approved-packages-${width}.png`), fullPage: true });
    // The image area, not only the title, activates one native card link.
    await page.locator("[data-collection-item]").first().click({ position: { x: 20, y: 20 } });
    await page.waitForURL("**/packages/zanzibar");
    await page.getByRole("heading", { name: "Zanzibar", exact: true }).waitFor();
    await page.getByText("Reference month: June 2027", { exact: true }).waitFor();
    const quoteLinks = page.getByRole("link", { name: "Check dates & get a quote", exact: true });
    await quoteLinks.first().waitFor();
    assert.ok(await quoteLinks.count() >= 1, "A quote CTA is accessible at every viewport");
    assert.equal(await page.locator('a[href="#plan"]').filter({ hasText: "Check dates & get a quote" }).count(), 2, "Desktop and mobile CTA variants remain in the document");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-package-detail-${width}.png`), fullPage: true });
    await page.goto(origin + "/packages/singapore", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Price coming soon", exact: true }).waitFor();
    assert.equal(await page.locator(".package-tiers").innerText().then(text => /GHS/.test(text)), false);
    let submissions = 0;
    await page.route("**/api/public/enquiries", async route => {
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      submissions++;
      const body = route.request().postDataJSON();
      assert.equal(body.name, "Synthetic Browser Traveller");
      assert.equal(body.enquiryType, "trip");
      assert.equal(body.travellers, 2);
      assert.equal(body.consent, true);
      assert.ok(body.submissionId);
      await route.fulfill({ status: 201, headers, contentType: "application/json",
        body: JSON.stringify({ ok: true,
          data: { inquiryId: "30000000-0000-4000-8000-000000000099", status: "received", replayed: false },
          meta: { requestId: "synthetic-browser-only" } }) });
    });
    const form = page.locator(".public-enquiry-form");
    await page.waitForFunction(() => {
      const submit = document.querySelector(".public-enquiry-form button[type=submit]");
      return submit instanceof HTMLButtonElement && !submit.disabled;
    });
    await form.locator('input[name="destination"]').fill("Help me choose");
    await form.locator('input[name="travelTimeframe"]').fill("Exploring next year");
    await form.locator('input[name="name"]').fill("Synthetic Browser Traveller");
    await form.locator('input[name="email"]').fill("browser@example.invalid");
    await form.locator('input[name="phone"]').fill("+233200000000");
    await form.locator('input[name="consent"]').check();
    await form.getByRole("button", { name: "Send enquiry", exact: true }).click();
    await form.getByRole("status").filter({ hasText: "Your enquiry is received" }).waitFor();
    assert.equal(submissions, 1);
    await page.goto(origin + "/journal", { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("[data-collection-item]").count(), 2);
    assert.equal(await page.getByText(/Demonstration editorial/).count(), 0);
    await page.goto(origin + "/", { waitUntil: "networkidle" });
    assert.equal(await page.locator(".public-enquiry-form").count(), 1);
    assert.equal(await page.getByText(/placeholder|Online enquiry.*not available|Enquiry availability/i).count(), 0);
    assert.equal(await page.locator('.travel-footprint svg [data-country-detail]').count(), 21);
    await page.getByRole("button", { name: "United Kingdom: 25+ visits", exact: true }).first().focus();
    await page.keyboard.press("Enter");
    await page.locator(".footprint-detail").filter({ hasText: "United Kingdom: 25+ visits" }).waitFor();
    assert.equal(await page.locator('[aria-label="Travel tips"] article').count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-home-${width}.png`), fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  for (const url of ["/demo/packages", "/demo/journal"]) {
    const page = await noJs.newPage();
    await page.goto(origin + url);
    assert.equal(await page.locator("[data-collection-item]").count(), 2);
    await page.close();
  }
  const published = await noJs.newPage();
  await published.goto(origin + "/packages");
  assert.equal(await published.locator("[data-collection-item]").count(), 4);
  await published.goto(origin + "/packages/nairobi");
  assert.equal(await published.locator("details").count(), 4);
  await published.locator("details summary").first().click();
  assert.equal(await published.locator("details").first().getAttribute("open"), "");
  await published.close();
  await noJs.close();
  console.log(JSON.stringify({ passed: true, widths: [320, 390, 768, 1440], noJavaScript: true, screenshots: output, scope: "Local synthetic Astro pages; no provider or real enquiry requests" }));
} finally {
  await browser?.close();
  if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already closed */ } }
}
