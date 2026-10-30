// Uses the repository's existing Playwright installation; no app/runtime dependency.
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  allowedTutorials,
  transitionProgress,
} from "../../travel-with-ease-api/src/onboarding/catalogue.js";
import { ROLE_PERMISSIONS } from "../../travel-with-ease-api/src/auth/permissions.js";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const origin = process.env.TWE_TEST_PORTAL_ORIGIN || "http://127.0.0.1:5197";
assert.equal(
  new URL(origin).hostname,
  "127.0.0.1",
  "Only isolated loopback portal testing is allowed",
);
const output = await mkdtemp(path.join(tmpdir(), "twe-onboarding-browser-"));
for (let attempt = 0; attempt < 30; attempt++) {
  try { if ((await fetch(origin)).ok) break; } catch { /* local server may still be starting */ }
  if (attempt === 29) throw new Error("Local portal did not start.");
  await new Promise(resolve => setTimeout(resolve, 1000));
}
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
      reducedMotion: "reduce",
      hasTouch: width < 768,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let progress = {
      status: "new",
      enabled: true,
      position: null,
      completed: [],
      last_completed_version: 0,
      revision: 0,
    };
    let role = "owner";
    let missingTarget = false;
    let activationRequired = false;
    const mutations = [];
    const envelope = (data) => ({
      ok: true,
      data,
      meta: { requestId: "synthetic-browser-test" },
    });
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const catalogue = allowedTutorials(ROLE_PERMISSIONS[role]);
      if (missingTarget) catalogue[0].steps[0].target = "removed-control";
      let data;
      if (request.method() === "POST") mutations.push(url.pathname);
      if (url.pathname === "/api/auth/status")
        data = { configured: true, mode: "cloudflare_access" };
      else if (url.pathname === "/api/auth/activation")
        data = { status: activationRequired ? "invitation_required" : "active", subject: "synthetic-subject", organisation: "Synthetic TWE" };
      else if (url.pathname === "/api/auth/activation/preview") data = { role: "owner", expiresAt: new Date(Date.now() + 60000).toISOString() };
      else if (url.pathname === "/api/auth/activation/claim") { activationRequired = false; data = { activated: true, role: "owner" }; }
      else if (url.pathname === "/api/auth/session")
        data = {
          user: {
            id: "synthetic-user",
            role,
            permissions: ROLE_PERMISSIONS[role],
          },
          csrfToken: "synthetic-csrf",
        };
      else if (url.pathname === "/api/auth/tutorials") {
        if (request.method() === "POST")
          progress = {
            ...transitionProgress(progress, request.postDataJSON(), catalogue),
            revision: progress.revision + 1,
          };
        data = { progress, catalogue, version: 1 };
      } else if (url.pathname === "/api/agent/content/home")
        data = {
          body: {
            heading: "Synthetic page",
            body: "",
            entries: [],
            seoTitle: "Synthetic",
            seoDescription: "Synthetic only",
            ctaLabel: "",
            ctaPath: "/#plan",
          },
          version: 0,
        };
      else data = { items: [], nextOffset: null, configured: false };
      await route.fulfill({ json: envelope(data) });
    });
    await page.goto(origin);
    const dialog = page.getByRole("dialog", {
      name: "Welcome to Travel With Ease",
    });
    await dialog.waitFor();
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("role")),
      "dialog",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const box = await dialog.boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.x + box.width <= width &&
        box.y >= 0 &&
        box.y + box.height <= 900,
    );
    await page.screenshot({
      path: path.join(output, `welcome-${width}.png`),
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("dialog", { name: "Your staff workspace" }).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]'),
    );
    await page.reload();
    await page.getByRole("button", { name: "Resume tutorial" }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Resume tutorial" }).click();
    await page.getByRole("dialog", { name: "Your staff workspace" }).waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Your dashboard" }).waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Choose a website page" }).waitFor();
    await page.locator('[data-tour="content-pages"].faako-tour-target').waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Skip for now" })
      .click();
    await page
      .getByRole("button", { name: "Tutorial Mode: On", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tutorial Mode: Off", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "Tutorial Mode: Off", exact: true })
      .waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Mark tutorial completed" }).click();
    await page.getByText("Introduction completed.", { exact: false }).waitFor();
    await page.reload();
    await page.getByText("Introduction completed.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    role = "editor";
    await page.reload();
    await page
      .getByRole("button", { name: "View available tutorials" })
      .click();
    assert.equal(
      await page
        .locator(".tutorial-list")
        .getByRole("button", { name: "Staff access", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator(".tutorial-list")
        .getByRole("button", { name: "Publishing", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    assert.ok(
      mutations.every((url) => url === "/api/auth/tutorials"),
      "Tutorials must not perform business mutations",
    );
    missingTarget = true;
    progress = { ...progress, status: "active", enabled: true, position: "welcome:1:workspace" };
    await page.reload();
    await page.getByText("This control is not currently visible.", { exact: false }).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    missingTarget = false;
    activationRequired = true;
    role = "owner";
    progress = { status: "new", enabled: true, position: null, completed: [], last_completed_version: 0, revision: 0 };
    await page.reload();
    await page.getByLabel(/^Invitation code/).fill("a".repeat(43));
    await page.getByRole("button", { name: "Review invitation", exact: true }).click();
    await page.getByRole("button", { name: "Confirm account activation", exact: true }).click();
    await page.getByRole("button", { name: "Enter workspace", exact: true }).click();
    const firstLogin = page.getByRole("dialog", { name: "Welcome to Travel With Ease" });
    await firstLogin.waitFor();
    await page.keyboard.press("Tab"); // Disabled Back is skipped.
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip for now");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Your staff workspace" }).waitFor();
    if (width < 768) await page.getByRole("dialog").getByRole("button", { name: "Skip for now" }).tap();
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    JSON.stringify({
      passed: true,
      viewports: [320, 390, 768, 1440],
      screenshots: output,
      scope: "Synthetic API browser tests; not hosted Access/MFA acceptance",
    }),
  );
} finally {
  await browser.close();
}
