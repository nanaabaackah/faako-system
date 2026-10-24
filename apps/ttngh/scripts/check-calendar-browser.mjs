// Local-only browser QA. Requires Playwright available in the workspace/parent.
// All calendar responses below are synthetic and never published.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (!extname(path)) path = path.replace(/\/$/, "") + "/index.html";
    const file = resolve(root, "." + path);
    if (!file.startsWith(root)) throw new Error("Outside fixture root");
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
    res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = process.env.TTNGH_QA_ORIGIN || "http://127.0.0.1:" + server.address().port;
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Local QA only");
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
const results = [];
try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let mode = "hold", release;
    const gate = new Promise(resolve => { release = resolve; });
    let calls = 0;
    await page.route("**/api/calendar/events?*", async route => {
      calls++;
      if (mode === "hold") await gate;
      if (mode === "fail") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Unavailable" } }) });
      const from = new URL(route.request().url()).searchParams.get("from");
      const date = from.slice(0, 8) + "20";
      const event = { id: "qa-1", uid: "qa-only", title: "QA fixture: a long community event title for narrow-screen wrapping without invented published content", start: date, end: from.slice(0, 8) + "22", allDay: true, location: "QA venue", timezone: "Africa/Accra", status: "confirmed" };
      const events = mode === "empty" ? [] : [event, { ...event, id: "qa-2", title: "<img src=x onerror=alert(1)> literal text", status: "tentative" }];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { events, freshnessSeconds: 300 } }) });
    });
    await page.goto(origin + "/events", { waitUntil: "domcontentloaded" });
    const essentials = page.getByRole("button", { name: "Essential only", exact: true });
    if (await essentials.isVisible()) await essentials.click();
    const calendar = page.locator("month-calendar");
    await calendar.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("month-calendar")?.classList.contains("month-loading"));
    assert.equal(await calendar.locator("tbody").evaluate(el => getComputedStyle(el).animationName), "none");
    assert.equal(await calendar.locator("[data-month-next]").isDisabled(), true);
    assert.equal(await calendar.locator(".month-placeholder").count(), 42, "initial pending request retains the skeleton");
    assert.equal(await calendar.locator("[data-day]").count(), 0);
    mode = "success"; release();
    await page.waitForFunction(() => document.querySelector("[data-month-status]")?.textContent.includes("2 scheduled"));
    assert.equal(await calendar.locator(".month-placeholder").count(), 0, "loaded dates replace the skeleton");
    const chosen = calendar.locator("[data-day$='-20']");
    await chosen.click();
    assert.equal(await calendar.locator(".month-agenda-event").count(), 2);
    assert.match(await calendar.locator(".month-agenda").innerText(), /All day|Tentative/);
    assert.equal(await calendar.locator(".month-agenda img").count(), 0);
    await calendar.screenshot({ path: "/tmp/ttngh-calendar-agenda-" + width + ".png" });
    await chosen.press("ArrowRight");
    assert.match(await page.locator(":focus").getAttribute("data-day"), /-21$/);
    await calendar.locator("[data-month-next]").click();
    await page.waitForFunction(() => !document.querySelector("[data-month-next]").disabled);
    const afterNext = calls;
    await calendar.locator("[data-month-prev]").click();
    await page.waitForFunction(() => !document.querySelector("[data-month-next]").disabled);
    assert.equal(calls, afterNext, "fresh month should be reused");
    await calendar.locator("[data-month-today]").click();
    await page.waitForFunction(() => !document.querySelector("[data-month-today]").disabled);
    assert.equal(await calendar.locator('[aria-current="date"]').getAttribute("aria-pressed"), "true");
    mode = "fail";
    await calendar.locator("[data-month-prev]").click();
    await page.waitForFunction(() => !document.querySelector("[data-month-retry]").hidden);
    assert.match(await calendar.locator("[data-month-status]").innerText(), /dates may have changed/);
    assert.equal(await calendar.locator("[data-day]").count() > 27, true);
    mode = "empty";
    await calendar.locator("[data-month-retry]").click();
    await page.waitForFunction(() => document.querySelector("[data-month-status]")?.textContent.includes("No events"));
    assert.equal(await calendar.locator("[data-day]").count() > 27, true);
    assert.equal(await page.locator('iframe[src*="calendar.google.com"]').count(), 0);
    const measurements = await page.evaluate(() => {
      const cal = document.querySelector("month-calendar"), button = cal.querySelector("[data-day]");
      const rect = button.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth - innerWidth, calendarOverflow: cal.scrollWidth - cal.clientWidth, targetWidth: rect.width, targetHeight: rect.height };
    });
    assert.ok(measurements.overflow <= 1, JSON.stringify(measurements));
    assert.ok(measurements.calendarOverflow <= 1);
    assert.ok(measurements.targetWidth >= 24 && measurements.targetHeight >= 44);
    await calendar.screenshot({ path: "/tmp/ttngh-calendar-" + width + ".png" });
    results.push({ width, ...measurements });
    await context.close();
  }
  console.log(JSON.stringify({ passed: results }, null, 2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
