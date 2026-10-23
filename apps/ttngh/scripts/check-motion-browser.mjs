import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { localTestServer } from "./local-test-server.mjs";
const server = await localTestServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  let checks = 0;
  const paths = ["/", "/about", "/programmes", "/events", "/impact", "/team", "/get-involved", "/contact", "/news", "/resources", "/support-us", "/404.html"];
  paths.push(...(await readdir(new URL("../dist/events/", import.meta.url), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => "/events/" + entry.name));
  for (const reducedMotion of process.env.TTNGH_CONTACT_QA_ONLY ? [] : ["no-preference", "reduce"]) for (const width of [320,375,390,430,768,1024,1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, hasTouch: width < 768 });
    const page = await context.newPage();
    await page.route("https://**/*", route => route.abort()); // Never contact real APIs/providers.
    for (const path of paths) {
      await page.goto(server.origin + path, { waitUntil: "load" });
      const essential = page.getByRole("button", { name: "Essential only", exact: true });
      if (await essential.isVisible()) await essential.click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + " overflow at " + width);
      for (const element of await page.locator("[data-reveal]").all()) {
        await element.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll("[data-reveal-pending]")].every(el => { const r = el.getBoundingClientRect(); return r.bottom < 0 || r.top >= innerHeight; }));
        if (reducedMotion === "reduce") assert.equal(await element.evaluate(el => getComputedStyle(el).opacity), "1");
      }
      const scroll = page.locator("scroll-expand-section").first();
      if (await scroll.count()) {
        await scroll.locator("a").focus();
        assert.equal(await scroll.locator(".scroll-expand__overlay").evaluate(el => getComputedStyle(el).opacity), "1");
        if ((width < 700 || reducedMotion === "reduce") && await scroll.locator(".scroll-expand__media").count()) assert.equal(await scroll.locator(".scroll-expand__media").first().evaluate(el => getComputedStyle(el).transform), "none");
      }
      checks++;
    }
    await context.close();
  }
  // No-JS content and signature CTA remain readable.
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await nojs.newPage();
  await staticPage.goto(server.origin + "/");
  assert.equal(await staticPage.locator("[data-reveal-pending]").count(), 0);
  assert.equal(await staticPage.locator("[data-reveal]").first().evaluate(el => getComputedStyle(el).opacity), "1");
  await nojs.close();
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion });
    let verifyLoads = 0, requests = 0, resolveRequest, failure = false;
    await page.route("**/turnstile/v0/api.js?*", route => {
      verifyLoads++;
      return route.fulfill({ contentType: "text/javascript", body: 'window.turnstile={render:(el,options)=>{window.testVerify=()=>options.callback("fixture-token");return "fixture-widget"},reset:()=>{window.testResets=(window.testResets||0)+1}};' });
    });
    await page.route("**/api/enquiries", async route => {
      requests++; await new Promise(resolve => { resolveRequest = resolve; });
      await route.fulfill({ status: failure ? 503 : 200, contentType: "application/json", body: JSON.stringify(failure ? { error: { message: "Unavailable" } } : { data: { accepted: true } }) });
    });
    await page.goto(server.origin + "/contact");
    const essential = page.getByRole("button", { name: "Essential only", exact: true });
    if (await essential.isVisible()) await essential.click();
    assert.equal(verifyLoads, 0, "Turnstile must remain manually loaded");
    await page.locator("[data-load-verification]").click();
    await page.waitForFunction(() => typeof window.testVerify === "function");
    const form = page.locator("[data-contact-form]"), button = form.locator('[type="submit"]');
    const fill = async () => {
      await form.locator('[name="name"]').fill("QA Visitor");
      await form.locator('[name="email"]').fill("qa@example.org");
      await form.locator('[name="topic"]').selectOption("Events");
      await form.locator('[name="message"]').fill("This is a local test enquiry with mocked delivery only.");
      await form.locator('[name="consent"]').check();
      await page.evaluate(() => window.testVerify());
    };
    for (failure of [false, true]) {
      await fill();
      const before = await button.boundingBox(), prior = requests;
      await button.click();
      await page.waitForFunction(() => document.querySelector("[data-async-state]").dataset.asyncState === "working");
      assert.equal(await button.getAttribute("aria-busy"), "true");
      assert.equal(await button.isDisabled(), true);
      assert.ok(Math.abs((await button.boundingBox()).width - before.width) < 1, JSON.stringify({ before: before.width, working: (await button.boundingBox()).width }));
      if (reducedMotion === "reduce") assert.equal(await button.locator(".async-spinner").evaluate(el => getComputedStyle(el).animationName), "none");
      await form.evaluate(el => el.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      await page.waitForTimeout(100);
      assert.equal(requests, prior + 1, "duplicate submit must not reach API");
      resolveRequest();
      await page.waitForFunction(state => document.querySelector("[data-async-state]").dataset.asyncState === state, failure ? "error" : "success");
      assert.equal(await button.getAttribute("aria-busy"), "false");
      if (failure) assert.equal(await button.isDisabled(), false);
    }
    assert.equal(await page.evaluate(() => window.testResets), 2);
    await page.close();
  }
  console.log(JSON.stringify({ routeViewportMotionChecks: checks, contactStateChecks: "passed", noJs: "passed" }));
} finally { await browser?.close(); await server.close(); }
