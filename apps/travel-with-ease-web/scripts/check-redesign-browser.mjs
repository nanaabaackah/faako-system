// Real Astro/components; local synthetic staging fixture and mocked API only.
import { createRequire } from "node:module";
import { mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
// Reuse existing repository accessibility tooling; no new app dependency.
const accessibilityRequire = createRequire(
  new URL("../../reebs-website/package.json", import.meta.url),
);
const axe = createRequire(
  accessibilityRequire.resolve("axe-playwright"),
).resolve("axe-core/axe.min.js");
const cwd = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), "twe-redesign-"));
const port = 4359;
const origin = `http://127.0.0.1:${port}`;
const apiOrigin = "https://staging-api.travelwitheasegh.com";
const snapshot = path.join(directory, "snapshot.json");
await writeFile(
  snapshot,
  JSON.stringify({
    version: 1,
    pages: {
      home: {
        heading: "Local test journey",
        body: "Synthetic content for browser verification only.",
        entries: [],
        image: {
          src: "/media/kenya-09d34a112ab0-1199.webp",
          alt: "Boats beside a lake in Kenya",
          width: 1199,
          height: 1600,
        },
      },
    },
  }),
);
let logs = "";
const server = spawn(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    `import { dev } from "astro"; await dev({ root: process.cwd(), server: { host: "127.0.0.1", port: ${port} }, devToolbar: { enabled: false } });`,
  ],
  {
    cwd,
    detached: true,
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
      PUBLIC_APP_ENV: "staging",
      PUBLIC_SITE_URL: "https://staging.travelwitheasegh.com",
      PUBLIC_API_BASE_URL: apiOrigin,
      PUBLIC_STAGING_DEMO_ENABLED: "true",
      TWE_CONTENT_SNAPSHOT: snapshot,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.on("data", (chunk) => {
  logs += chunk;
});
server.stderr.on("data", (chunk) => {
  logs += chunk;
});
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* Starting owned server. */
    }
    if (attempt === 59) throw Error(logs.slice(-2000));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    console.log(`Checking TWE redesign at ${width}px`);
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let submissions = 0;
    let releaseSubmission;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (
        url.origin === apiOrigin &&
        url.pathname === "/api/public/demo-inquiries"
      ) {
        submissions++;
        const body = route.request().postDataJSON();
        assert.equal(body.kind, "package");
        assert.equal(body.destination, "Zanzibar");
        assert.equal(body.email, "synthetic@example.invalid");
        await new Promise((resolve) => {
          releaseSubmission = resolve;
        });
        return route.fulfill({
          status: submissions === 1 ? 503 : 201,
          contentType: "application/json",
          body: JSON.stringify(
            submissions === 1
              ? {
                  ok: false,
                  error: {
                    code: "service_unavailable",
                    message: "Synthetic service unavailable",
                  },
                  meta: { requestId: "local-test" },
                }
              : {
                  ok: true,
                  data: {
                    demo: true,
                    status: "received",
                    inquiryId: "local-synthetic-reference",
                  },
                  meta: { requestId: "local-test" },
                },
          ),
        });
      }
      throw Error(`Unexpected external request blocked: ${url.origin}`);
    });
    await page.goto(`${origin}/demo`, { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Essential only", exact: true })
      .click();
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "noindex, nofollow",
    );
    assert.equal(await page.locator("[data-analytics-config]").count(), 0);
    if (width <= 900) {
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      await menu.focus();
      await page.keyboard.press("Enter");
      assert.equal(await menu.getAttribute("aria-expanded"), "true");
      await page.locator("#primary-navigation a").first().focus();
      await page.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      assert.ok(
        await menu.evaluate((element) => element === document.activeElement),
      );
    }
    const map = page.locator(".travel-footprint:not(.compact)");
    const country = map.locator('[data-country-code="TZ"]');
    await country.focus();
    await page.keyboard.press("Enter");
    assert.match(
      await map.locator(".footprint-detail").textContent(),
      /Tanzania: 4 combined trips/,
    );
    assert.equal(
      await map.evaluate(
        (element) =>
          getComputedStyle(element.closest(".cream-footprint")).backgroundColor,
      ),
      "rgb(244, 237, 227)",
    );
    const disclosure = page.locator("#demo-faqs details").first();
    await disclosure.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await disclosure.getAttribute("open"), "");
    await page.keyboard.press("Enter");
    assert.equal(await disclosure.getAttribute("open"), null);
    // Do not exercise an island action until hydration has attached its handlers.
    await page.waitForFunction(() => {
      const submit = document.querySelector(
        '.demo-enquiry-form button[type="submit"]',
      );
      return submit && !submit.disabled;
    });
    await page.locator('[data-demo-destination="Zanzibar"]').click();
    await page
      .getByRole("heading", { name: "Sample package enquiry", exact: true })
      .waitFor();
    await page
      .getByLabel("Full name", { exact: true })
      .fill("Synthetic traveller");
    await page
      .getByLabel("Email", { exact: true })
      .fill("synthetic@example.invalid");
    await page
      .getByLabel("Phone / WhatsApp", { exact: true })
      .fill("+233200000000");
    await page.locator('input[name="consent"]').check();
    await page
      .getByRole("button", { name: "Submit test enquiry", exact: true })
      .click();
    await page.getByText("Saving test enquiry", { exact: true }).waitFor();
    await page.waitForFunction(() =>
      document.querySelector('.demo-enquiry-form [aria-busy="true"]'),
    );
    while (!releaseSubmission)
      await new Promise((resolve) => setTimeout(resolve, 10));
    releaseSubmission();
    releaseSubmission = null;
    await page
      .getByText("Synthetic service unavailable", { exact: true })
      .waitFor();
    assert.equal(submissions, 1, "No automatic mutation retries");
    await page
      .getByRole("button", { name: "Submit test enquiry", exact: true })
      .click();
    await page.getByText("Saving test enquiry", { exact: true }).waitFor();
    while (!releaseSubmission)
      await new Promise((resolve) => setTimeout(resolve, 10));
    releaseSubmission();
    releaseSubmission = null;
    await page
      .locator("#demo-result")
      .filter({ hasText: "Staging test enquiry received" })
      .waitFor();
    assert.equal(submissions, 2);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.addScriptTag({ path: axe });
    const accessibility = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((node) => node.target),
      })),
    );
    assert.deepEqual(accessibility, [], `Accessibility at ${width}px`);
    await page.screenshot({
      path: path.join(directory, `demo-${width}.png`),
      fullPage: true,
    });
    for (const [name, selector] of [
      ["hero", ".cinematic-hero"],
      ["map", "#demo-footprint"],
      ["cta", ".closing-cta"],
      ["footer", ".twe-public-footer"],
    ]) {
      await page
        .locator(selector)
        .screenshot({ path: path.join(directory, `${name}-${width}.png`) });
    }
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(
      await page
        .getByRole("heading", { name: "Local test journey", exact: true })
        .count(),
      1,
    );
    assert.equal(await page.locator(".cinematic-hero__image").count(), 1);
    assert.equal(await page.locator(".footprint-empty").count(), 2);
    assert.equal(
      await page.locator(".footer-signature").textContent(),
      "TRAVEL WITH EASE",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await noJs.newPage();
  await page.goto(`${origin}/demo`);
  assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
  assert.equal(await page.locator(".cinematic-hero__copy").isVisible(), true);
  await page.locator("#demo-faqs summary").first().click();
  assert.equal(
    await page.locator("#demo-faqs details").first().getAttribute("open"),
    "",
  );
  await noJs.close();
  const motionContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(origin, { waitUntil: "networkidle" });
  await motionPage
    .getByRole("button", { name: "Essential only", exact: true })
    .click();
  await motionPage.locator(".cinematic-enquiry").scrollIntoViewIfNeeded();
  assert.equal(await motionPage.locator("#enquiry-heading").isVisible(), true);
  const footerTop = await motionPage
    .locator(".twe-public-footer")
    .evaluate((element) => element.getBoundingClientRect().top + scrollY);
  await motionPage.evaluate(
    (top) => scrollTo({ top, behavior: "instant" }),
    footerTop - 400,
  );
  await motionPage.screenshot({
    path: path.join(directory, "enquiry-footer-transition-1440.png"),
  });
  await motionPage.locator(".footer-signature").scrollIntoViewIfNeeded();
  assert.equal(await motionPage.locator(".footer-signature").isVisible(), true);
  await motionPage.screenshot({
    path: path.join(directory, "signature-motion-1440.png"),
  });
  await motionContext.close();
  console.log(
    JSON.stringify({
      passed: true,
      widths: [320, 375, 390, 768, 1024, 1440],
      screenshots: directory,
      axe: true,
      noJavaScript: true,
      scope:
        "Local mocked staging only; no real submissions or provider requests",
    }),
  );
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* Already exited. */
  }
}
