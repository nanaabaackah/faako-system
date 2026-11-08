// Actual local fixture server and portal; no Playwright API interception.
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const output = await mkdtemp(path.join(tmpdir(), "twe-workspace-refinements-"));
const portal = "http://127.0.0.1:5188",
  web = "http://127.0.0.1:4328";
for (const origin of [portal, web]) {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Owned local servers starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.ok(
    ready,
    "Start pnpm run dev:twe:workspace before browser acceptance.",
  );
}
const reset = () =>
  fetch(portal + "/__workspace", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TWE-Workspace": "local-preview",
    },
    body: JSON.stringify({ action: "role", role: "owner" }),
  });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  for (const width of [320, 390, 768, 1440]) {
    assert.equal((await reset()).status, 200);
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) =>
      [portal, web].includes(new URL(route.request().url()).origin)
        ? route.continue()
        : route.abort(),
    );
    await page.goto(portal, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Dashboard", exact: true })
      .waitFor();
    await page
      .getByRole("complementary", { name: "Local workspace preview" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: path.join(output, `dashboard-${width}.png`),
      fullPage: true,
    });
    const navigate = async (name) => {
      let button = page
        .getByRole("button", { name, exact: true })
        .filter({ visible: true })
        .first();
      if (!(await button.count())) {
        await page.getByRole("button", { name: /^Menu/ }).click();
        button = page
          .getByRole("button", { name, exact: true })
          .filter({ visible: true })
          .first();
      }
      await button.click();
    };
    await navigate("Content");
    await page.getByLabel(/^Heading/).fill("Local-only edited heading");
    await page.waitForFunction(() =>
      document
        .querySelector(".draft-save-status")
        ?.textContent.includes("Saved · version 2"),
    );
    await page
      .getByRole("button", { name: "Preview saved content", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Local-only edited heading", exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(output, `content-${width}.png`),
      fullPage: true,
    });
    await navigate("Enquiries");
    await page
      .getByRole("button", { name: /Demo Traveller/ })
      .first()
      .click();
    await page.screenshot({
      path: path.join(output, `enquiry-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Preview role", exact: true })
      .click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("option", { name: "Editor", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector(".session-toolbar")
        ?.textContent.includes("editor"),
    );
    assert.equal(
      await page.getByRole("button", { name: "System", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "Staff", exact: true }).count(),
      0,
    );
    await page
      .getByRole("button", { name: "Preview role", exact: true })
      .click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("option", { name: "Superadmin", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector(".session-toolbar")
        ?.textContent.includes("Superadmin"),
    );
    await navigate("System");
    await page.screenshot({
      path: path.join(output, `system-${width}.png`),
      fullPage: true,
    });
    await page.goto(web, { waitUntil: "networkidle" });
    const consent = page.getByRole("button", {
      name: "Essential only",
      exact: true,
    });
    if (await consent.isVisible()) await consent.click();
    const services = page.locator("#services");
    await services.scrollIntoViewIfNeeded();
    assert.equal(await services.locator(".home-services__item").count(), 4);
    assert.equal(await services.locator("img").count(), 1);
    assert.equal(
      await services
        .locator(".home-services__row")
        .first()
        .evaluate((node) => getComputedStyle(node).boxShadow),
      "none",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await services.screenshot({
      path: path.join(output, `services-${width}.png`),
    });
    for (const url of [
      "/packages/nairobi",
      "/services/full-trip-planning",
      "/journal/how-travel-with-ease-began",
      "/travel-tips/get-a-live-quote-before-you-pay",
    ]) {
      const response = await page.goto(web + url, {
        waitUntil: "domcontentloaded",
      });
      assert.equal(response.status(), 200);
      const breadcrumb = page.getByRole("navigation", {
        name: "Breadcrumb",
        exact: true,
      });
      assert.equal(await breadcrumb.locator("li").count(), 3);
      assert.equal(
        await breadcrumb.locator("[aria-current=page] a").count(),
        0,
      );
      assert.equal(await breadcrumb.getByRole("link").count(), 2);
      await breadcrumb.getByRole("link", { name: "Home", exact: true }).focus();
      assert.notEqual(
        await breadcrumb
          .getByRole("link", { name: "Home", exact: true })
          .evaluate((node) => getComputedStyle(node).outlineStyle),
        "none",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
    await page.screenshot({
      path: path.join(output, `breadcrumbs-${width}.png`),
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const page = await noJs.newPage();
  await page.goto(web + "/services/full-trip-planning");
  assert.equal(
    await page
      .getByRole("navigation", { name: "Breadcrumb", exact: true })
      .getByRole("link")
      .count(),
    2,
  );
  await noJs.close();
  console.log(
    JSON.stringify({
      passed: true,
      widths: [320, 390, 768, 1440],
      noJavaScript: true,
      screenshots: output,
      providers: "none; isolated local fixtures",
    }),
  );
} finally {
  try { await reset(); } finally { await browser.close(); }
}
