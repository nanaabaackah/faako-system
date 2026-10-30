import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const origin = process.env.TWE_TEST_PORTAL_ORIGIN || "http://127.0.0.1:5197";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const output = await mkdtemp(path.join(tmpdir(), "twe-content-demo-"));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const requests = [];
    await page.route("**/api/**", (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.goto(`${origin}/?demo=1`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Content", exact: true })
      .first()
      .click();
    const select = async (value) => {
      await page.getByRole("button", { name: "Section", exact: true }).click();
      await page.getByRole("option", { name: value, exact: true }).click();
    };
    await select("journal");
    await page.getByLabel(/^Title/).fill("Changed demo article");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview saved content", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Changed demo article", exact: true })
      .waitFor();
    await select("travel-footprint");
    await page
      .getByLabel(/^Combined verified total/)
      .first()
      .fill("13");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview saved content", exact: true })
      .click();
    await page
      .getByText("Kenya: 13 verified combined trips", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: path.join(output, `footprint-${width}.png`),
      fullPage: true,
    });
    await select("privacy");
    await page
      .getByRole("button", { name: "Load review draft", exact: true })
      .click();
    assert.equal(
      await page.getByLabel(/^Heading/).inputValue(),
      "Privacy notice",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Request publication", exact: true })
        .isEnabled(),
      false,
    );
    await page.screenshot({
      path: path.join(output, `policy-${width}.png`),
      fullPage: true,
    });
    assert.deepEqual(
      requests,
      [],
      "Demo content controls must never call the API",
    );
    await context.close();
  }
  console.log(
    JSON.stringify({
      passed: true,
      widths: [320, 390, 768, 1440],
      screenshots: output,
      scope: "Real portal components using the in-memory demo adapter",
    }),
  );
} finally {
  await browser.close();
}
