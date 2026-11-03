// Test harness only: synthetic staff session and no database/provider access.
/* global document, innerWidth */
import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PreviewService } from "../src/content/preview.js";
import { contentRoutes } from "../src/content/routes.js";

const require = createRequire(new URL("../../stroane-web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const actor = { id: "synthetic-editor", organisationId: "synthetic-test-tenant" };
const service = new PreviewService({ organisationId: actor.organisationId, environment: "test",
  siteOrigin: "https://staging.travelwitheasegh.com", apiOrigin: "",
  repository: {
    list: async () => [{ slug: "home" }],
    get: async slug => slug === "home" ? { version: 1, body: { heading: "Private preview fixture", body: "A synthetic draft for local verification only.", seoTitle: "Private preview", seoDescription: "Test only" } } : null,
  },
});
const app = express(); app.use(express.json());
const auth = {
  requirePermission: () => (req, res, next) => {
    if (req.headers.cookie !== "twe_preview_fixture=1") return res.sendStatus(401);
    req.staff = actor; next();
  },
  requireMutation: (req, res, next) => req.headers["x-csrf-token"] === "synthetic-csrf" ? next() : res.sendStatus(403),
};
app.use("/api/agent/content", contentRoutes({ repository: service.repository, preview: service, auth }));
const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const output = await mkdtemp(path.join(tmpdir(), "twe-private-preview-browser-"));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
try {
  const response = await fetch(`${origin}/api/agent/content/home/visual-preview`, { method: "POST", headers: { "Content-Type": "application/json", cookie: "twe_preview_fixture=1", "X-CSRF-Token": "synthetic-csrf" }, body: JSON.stringify({ expectedVersion: 1 }) });
  assert.equal(response.status, 200); const job = (await response.json()).data;
  const deadline = Date.now() + 180_000;
  let result;
  do {
    result = service.get(job.id, actor);
    if (result.status !== "building") break;
    await new Promise(done => setTimeout(done, 250));
  } while (Date.now() < deadline);
  assert.equal(result.status, "ready", result.message);
  assert.equal((await fetch(origin + result.url)).status, 401, "Anonymous draft access must fail");
  const privateResponse = await fetch(origin + result.url, { headers: { cookie: "twe_preview_fixture=1" } });
  assert.match(privateResponse.headers.get("content-security-policy"), /script-src 'none'/);
  assert.match(privateResponse.headers.get("x-robots-tag"), /noindex/);
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "twe_preview_fixture", value: "1", url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + result.url, { waitUntil: "networkidle" });
    assert.equal(await page.locator("main h1").innerText(), "Private preview fixture");
    assert.equal(await page.locator(".closing-scene").count(), 1);
    await page.evaluate(async () => { document.querySelectorAll("img").forEach(image => image.loading = "eager"); await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); await document.fonts.ready; });
    const broken = await page.locator("img").evaluateAll(images => images.filter(image => !image.naturalWidth).map(image => image.getAttribute("src")));
    assert.deepEqual(broken, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator("script").count(), 0);
    await page.screenshot({ path: path.join(output, `private-preview-${width}.png`), fullPage: true });
    await context.close();
  }
  console.log(JSON.stringify({ status: "passed", actualAstroBuild: true, widths: [320, 390, 768, 1440], output }));
} finally {
  await browser.close(); await new Promise(done => server.close(done));
  for (const job of service.jobs.values()) job.expires = 0;
  await service.cleanup();
}
