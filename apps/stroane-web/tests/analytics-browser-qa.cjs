// Run against a local production storefront build. Google requests are always mocked.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { chromium } = require("playwright");

const base = process.env.STROANE_QA_URL || "http://localhost:4175";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Local QA only");

const envText = readFileSync(new URL("../.env", `file://${__dirname}/`), "utf8");
const configuredId = envText
  .split(/\r?\n/)
  .find((line) => line.startsWith("VITE_GA_MEASUREMENT_ID="))
  ?.split("=")
  .slice(1)
  .join("=")
  .replace(/^['"]|['"]$/g, "")
  .trim();
const measurementId = process.env.STROANE_QA_GA_ID || configuredId;
if (!measurementId) throw Error("Stroane GA4 measurement ID is not configured");

(async () => {
  const browser = await chromium.launch();
  try {
    for (const dnt of [false, true]) {
      const context = await browser.newContext();
      await context.addInitScript((value) => {
        Object.defineProperty(navigator, "doNotTrack", { get: () => value ? "1" : "0" });
      }, dnt);
      let tagRequests = 0;
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(base).origin) return route.continue();
        if (url.hostname === "www.googletagmanager.com") {
          assert.equal(url.searchParams.get("id"), measurementId);
          tagRequests += 1;
          return route.fulfill({ contentType: "text/javascript", body: "/* isolated tag stub */" });
        }
        return route.abort();
      });

      const page = await context.newPage();
      await page.goto(base, { waitUntil: "domcontentloaded" });
      assert.equal(tagRequests, 0);
      await page.getByRole("button", { name: "Accept all", exact: true }).click();

      if (dnt) {
        await page.waitForTimeout(250);
        assert.equal(tagRequests, 0);
        assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
      } else {
        await page.waitForFunction(() => window.dataLayer?.some((item) => item[0] === "event" && item[1] === "page_view"));
        assert.equal(tagRequests, 1);
        assert.equal(await page.evaluate(() => window.dataLayer.filter((item) => item[0] === "event" && item[1] === "page_view").length), 1);

        await page.locator('a[href="/about"]').first().click();
        await page.waitForURL(`${base}/about`);
        await page.waitForFunction(() => window.dataLayer.filter((item) => item[0] === "event" && item[1] === "page_view").length === 2);
        await page.evaluate(() => window.dispatchEvent(new CustomEvent("stroane-cookie-preferences", {
          detail: { necessary: true, analytics: true, marketing: true, updatedAt: new Date().toISOString() },
        })));
        assert.equal(await page.evaluate(() => window.dataLayer.filter((item) => item[0] === "event" && item[1] === "page_view").length), 2);

        await page.evaluate(() => { document.cookie = "_ga_QATEST=temporary; Path=/; SameSite=Lax"; });
        await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
        await page.getByRole("button", { name: "Reject optional", exact: true }).click();
        assert.equal(await page.evaluate(() => document.cookie.includes("_ga_QATEST=")), false);
        await page.locator('a[href="/services"]').first().click();
        await page.waitForURL(`${base}/services`);
        assert.equal(await page.evaluate(() => window.dataLayer.filter((item) => item[0] === "event" && item[1] === "page_view").length), 2);
      }

      await context.close();
    }
    console.log("PASS: Stroane storefront opt-in, SPA routes, deduplication, withdrawal, cookie cleanup, correct stream and Do Not Track. Google requests mocked.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
