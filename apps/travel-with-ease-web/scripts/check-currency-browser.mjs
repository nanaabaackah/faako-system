// Actual public components; synthetic rates only. No provider, mail or enquiry requests.
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(new URL("../../stroane-web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const directory = await mkdtemp(path.join(tmpdir(), "twe-currency-"));
const origin = process.env.TWE_TEST_WEB_ORIGIN || "http://127.0.0.1:4362";
assert.equal(new URL(origin).hostname, "127.0.0.1");
let server, browser, logs = "";
try {
  if (!process.env.TWE_TEST_WEB_ORIGIN) {
    server = spawn(process.execPath, ["--input-type=module", "-e", 'import { dev } from "astro"; await dev({root:process.cwd(),server:{host:"127.0.0.1",port:4362},devToolbar:{enabled:false}});'], {
      cwd: fileURLToPath(new URL("../", import.meta.url)), detached: true,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", PUBLIC_APP_ENV: "development", TWE_CONTENT_SNAPSHOT: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", chunk => { logs += chunk; });
    server.stderr.on("data", chunk => { logs += chunk; });
  }
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Owned server starting. */ }
    if (i === 59) throw new Error(logs.slice(-2000));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", hasTouch: width < 768 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let failure = false, expired = false, stale = false, delayed = false;
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.origin === origin && !url.pathname.startsWith("/api/") ? route.continue() : route.abort();
    });
    await page.route(url => url.pathname === "/api/public/currency", async route => {
      const currency = new URL(route.request().url()).searchParams.get("currency");
      assert.ok(["USD", "GBP", "EUR", "CAD"].includes(currency));
      if (delayed) await new Promise(resolve => setTimeout(resolve, 300));
      if (failure) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "service_unavailable", message: "Synthetic outage" } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: {
        baseCurrency: "GHS", currency, rate: currency === "GBP" ? "0.06" : "0.08",
        updatedAt: new Date(Date.now() - (expired ? 73 : stale ? 40 : 0) * 3_600_000).toISOString(),
        stale, indicative: true, provider: "exchange-rate-api",
      } }) });
    });
    const choose = async (currency, keyboard = false) => {
      const trigger = page.getByRole("button", { name: "Display currency", exact: true });
      await trigger.click();
      const option = page.getByRole("option", { name: new RegExp(`^${currency} ·`) });
      if (keyboard) { await option.focus(); await page.keyboard.press("Enter"); }
      else if (width < 768) await option.tap();
      else await option.click();
    };
    await page.goto(origin + "/packages", { waitUntil: "networkidle" });
    const consent = page.getByRole("button", { name: "Essential only", exact: true });
    if (await consent.isVisible()) await consent.click();
    await choose("USD");
    await page.locator(".footer-currency [role=status]").filter({ hasText: /^USD estimates/ }).waitFor();
    assert.equal(await page.locator("[data-money-value]").first().innerText(), "≈ USD 2,000.00");
    assert.ok(await page.locator("[data-money-original]").first().isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.footer-legal nav .footer-currency').count(), 1);
    assert.ok((await page.getByRole("button", { name: "Display currency", exact: true }).boundingBox()).width < 110);
    assert.equal(await page.locator('footer [data-currency-attribution]').count(), 0);
    assert.equal(await page.locator('[data-currency-attribution]:visible').count(), 1);
    await page.locator(".footer-currency").screenshot({ path: path.join(directory, `footer-${width}.png`) });
    await page.goto(origin + "/services", { waitUntil: "networkidle" });
    await page.locator(".footer-currency [role=status]").filter({ hasText: /^USD estimates/ }).waitFor();
    assert.equal(await page.locator(".service-panel [data-money-value]").first().innerText(), "≈ USD 32.00");
    await page.goto(origin + "/packages/zanzibar", { waitUntil: "networkidle" });
    await page.locator(".footer-currency [role=status]").filter({ hasText: /^USD estimates/ }).waitFor();
    assert.ok(await page.locator(".package-tiers [data-money-value]").count() > 1);
    await choose("GBP", true);
    await page.locator(".footer-currency [role=status]").filter({ hasText: /^GBP estimates/ }).waitFor();
    assert.equal(await page.locator("[data-money-value]").first().innerText(), "≈ GBP 1,500.00");
    failure = true;
    await choose("EUR");
    await page.getByRole("button", { name: "Retry conversion", exact: true }).waitFor();
    assert.equal(await page.locator("[data-money-value]").first().innerText(), "GHS 25,000");
    failure = false; expired = true;
    await choose("CAD");
    await page.locator(".footer-currency [role=status]").filter({ hasText: "CAD conversion is unavailable" }).waitFor();
    assert.equal(await page.locator("[data-money-value]").first().innerText(), "GHS 25,000");
    expired = false; stale = true;
    await page.getByRole("button", { name: "Retry conversion", exact: true }).click();
    await page.locator(".footer-currency [role=status]").filter({ hasText: "cached rate" }).waitFor();
    delayed = true;
    await choose("USD");
    await choose("GHS");
    await page.locator(".footer-currency [role=status]").filter({ hasText: "Prices are shown in Ghanaian cedi" }).waitFor();
    await page.waitForTimeout(400);
    assert.equal(await page.locator("[data-money-value]").first().innerText(), "GHS 25,000");
    assert.equal(await page.evaluate(() => localStorage.getItem("twe-display-currency-v1")), "GHS");
    assert.deepEqual(errors, []);
    await context.close();
  }
  const expiryContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const expiryPage = await expiryContext.newPage();
  await expiryPage.clock.install({ time: new Date() });
  await expiryPage.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await expiryPage.route(url => url.pathname === "/api/public/currency", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: {
      baseCurrency: "GHS", currency: "USD", rate: "0.08", updatedAt: new Date().toISOString(),
      stale: false, indicative: true, provider: "exchange-rate-api",
    } }),
  }));
  await expiryPage.goto(origin + "/packages", { waitUntil: "networkidle" });
  await expiryPage.getByRole("button", { name: "Essential only", exact: true }).click();
  await expiryPage.getByRole("button", { name: "Display currency", exact: true }).click();
  await expiryPage.getByRole("option", { name: /^USD ·/ }).click();
  await expiryPage.locator(".footer-currency [role=status]").filter({ hasText: /^USD estimates/ }).waitFor();
  await expiryPage.clock.fastForward(72 * 3_600_000 + 60_000);
  await expiryPage.locator(".footer-currency [role=status]").filter({ hasText: "rate has expired" }).waitFor();
  assert.equal(await expiryPage.locator("[data-money-value]").first().innerText(), "GHS 25,000");
  await expiryContext.close();
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const page = await noJs.newPage();
  await page.goto(origin + "/packages/zanzibar");
  assert.equal(await page.locator("[data-money-value]").first().innerText(), "GHS 25,000");
  assert.ok(await page.getByRole("button", { name: "Display currency", exact: true }).isDisabled());
  await noJs.close();
  const policy = await browser.newPage();
  await policy.goto(origin + "/terms");
  await policy.getByRole("heading", { name: "Display currency and indicative exchange rates", exact: true }).waitFor();
  await policy.close();
  console.log(JSON.stringify({ passed: true, widths: [320, 390, 768, 1440], noJavaScript: true, screenshots: directory, providers: "mocked only" }));
} finally {
  await browser?.close();
  if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ } }
}
