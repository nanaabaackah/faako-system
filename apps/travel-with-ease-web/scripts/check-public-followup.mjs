// Local fixtures and real Astro components; no provider or customer submissions.
import { createRequire } from "node:module";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { enquiryTemplate } from "../../travel-with-ease-api/src/notifications/enquiry-template.js";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const directory = await mkdtemp(path.join(tmpdir(), "twe-public-followup-"));
const cwd = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.TWE_TEST_PUBLIC_PORT || "4351");
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
const origin = `http://127.0.0.1:${port}`;
const base = {
  heading: "Synthetic browser fixture",
  body: "Local verification only",
  seoTitle: "Synthetic",
  seoDescription: "Synthetic browser verification",
  entries: [],
  ctaLabel: "",
  contactEmail: "",
  contactPhone: "",
};
const snapshot = path.join(directory, "snapshot.json");
await writeFile(
  snapshot,
  JSON.stringify({
    version: 1,
    pages: {
      home: base,
      privacy: base,
      cookies: base,
      services: base,
      "how-it-works": base,
      journal: {
        ...base,
        articles: [
          {
            slug: "synthetic-guide",
            title: "Synthetic guide",
            excerpt: "A local test article",
            body: "First paragraph.\n\nLiteral <script> text.",
            date: "2026-10-30",
          },
        ],
      },
      "travel-footprint": {
        ...base,
        footprint: [{ countryCode: "TZ", total: 4, status: "verified" }],
      },
    },
  }),
);
let logs = "";
// Programmatic dev avoids the CLI's per-workspace agent daemon and lock file.
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
      PUBLIC_APP_ENV: "development",
      TWE_CONTENT_SNAPSHOT: snapshot,
      PUBLIC_GA_MEASUREMENT_ID: "G-TEST123456",
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
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* Starting local server. */
    }
    if (i === 59)
      throw new Error(`Local Astro did not start: ${logs.slice(-1000)}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    let googleRequests = 0;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (/google-analytics|googletagmanager/.test(url.hostname))
        googleRequests++;
      return route.abort();
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(googleRequests, 0, "No optional analytics before consent");
    await page
      .getByRole("button", { name: "Manage preferences", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    assert.equal(await page.locator("[data-cookie-notice]").isVisible(), false);
    const whatsapp = page.getByRole("link", {
      name: "Chat with Travel With Ease on WhatsApp",
    });
    assert.equal(
      await whatsapp.getAttribute("href"),
      "https://wa.me/233208387020",
    );
    const left = await whatsapp.boundingBox(),
      right = await page.locator(".floating-top").boundingBox();
    assert.ok(left.x < width / 2 && right.x > width / 2);
    assert.ok(left.height >= 44 && right.height >= 44);
    await whatsapp.focus();
    assert.equal(
      await whatsapp.evaluate((element) => element === document.activeElement),
      true,
    );
    await page
      .getByRole("button", { name: "Cookie settings", exact: true })
      .click();
    await page.locator("[data-cookie-analytics-choice]").check();
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("twe-cookie-consent-v1")).analytics,
      ),
      true,
    );
    await page
      .getByRole("button", { name: "Cookie settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Essential only", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("twe-cookie-consent-v1")).analytics,
      ),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: path.join(directory, `website-${width}.png`),
      fullPage: true,
    });
    await page.goto(`${origin}/journal/synthetic-guide`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(
      await page
        .getByRole("heading", { name: "Synthetic guide", exact: true })
        .count(),
      1,
    );
    await page.getByText("Literal <script> text.", { exact: true }).waitFor();
    await page.goto(`${origin}/travel-footprint`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(
      await page
        .locator('.travel-footprint:not(.compact) [data-country-code="TZ"]')
        .getAttribute("aria-label"),
      "Tanzania: 4 combined trips",
    );
    await page.goto(`${origin}/demo`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Manage preferences", exact: true })
      .click();
    await page.locator("[data-cookie-analytics-choice]").check();
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("twe-demo-cookie-consent-v1"))
            .analytics,
      ),
      true,
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("twe-cookie-consent-v1")).analytics,
      ),
      false,
    );
    assert.equal(
      await page.locator("[data-analytics-config]").count(),
      0,
      "Demo never loads analytics",
    );
    await page
      .getByRole("heading", {
        name: "Travel planning from Ghana.",
        exact: true,
      })
      .waitFor();
    await page.screenshot({
      path: path.join(directory, `demo-${width}.png`),
      fullPage: true,
    });
    await page
      .getByText("Preview the acknowledgement email", { exact: true })
      .click();
    await page
      .frameLocator(
        'iframe[title="Travel With Ease acknowledgement email design"]',
      )
      .getByRole("heading", { name: "Email delivery preview", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    const email = await context.newPage();
    await email.route("https://travelwitheasegh.com/**", async (route) => {
      const filename = decodeURIComponent(
        new URL(route.request().url()).pathname,
      );
      if (!filename.startsWith("/brand/") || filename.includes(".."))
        return route.abort();
      await route.fulfill({
        body: await readFile(path.join(cwd, "public", filename)),
        contentType: "image/png",
      });
    });
    await email.setContent(
      enquiryTemplate({ name: "Test traveller", test: true }).html,
    );
    await email
      .getByRole("heading", { name: "Email delivery preview" })
      .waitFor();
    assert.equal(
      await email.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await email.screenshot({
      path: path.join(directory, `email-${width}.png`),
      fullPage: true,
    });
    await context.close();
  }
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await noJs.newPage();
  await page.goto(`${origin}/journal/synthetic-guide`);
  assert.equal(
    await page.getByRole("heading", { name: "Synthetic guide" }).count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Chat with Travel With Ease on WhatsApp" })
      .count(),
    1,
  );
  await noJs.close();
  console.log(
    JSON.stringify({
      passed: true,
      widths: [320, 390, 768, 1440],
      noJavaScript: true,
      screenshots: directory,
      scope: "Local synthetic content; no live provider or submissions",
    }),
  );
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* Server already exited. */
  }
}
