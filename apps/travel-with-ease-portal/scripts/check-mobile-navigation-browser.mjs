// Real portal components, isolated HTTP fixtures; no hosted requests or mutations.
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { mockWorkspaceApi } from "../test/fixtures/browser-api.js";
const require = createRequire(new URL("../../stroane-web/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const origin = process.env.TWE_TEST_PORTAL_ORIGIN || "http://127.0.0.1:5197";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const output = await mkdtemp(path.join(tmpdir(), "twe-mobile-navigation-"));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});
try {
  for (const role of ["owner", "editor", "platform_admin"]) {
    for (const width of [320, 375, 390, 428, 768, 1024]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 }, hasTouch: width <= 800,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mockWorkspaceApi(page, { role });
      await page.goto(origin);
      await page.locator(".session-toolbar").waitFor();
      await expect(page.locator(".session-toolbar > span")).toContainText(
        `Signed in as ${role === "platform_admin" ? "Superadmin" : role}`,
      );
      const nav = page.getByRole("navigation", { name: "Workspace shortcuts" });
      if (width > 800) {
        await expect(nav).toBeHidden();
        await expect(page.getByRole("navigation", { name: "Staff navigation" })).toBeVisible();
      } else {
        await expect(nav).toBeVisible();
        assert.deepEqual(await nav.getByRole("button").allTextContents(),
          ["Home", "Enquiries", "Content", "Media", "Account"]);
        for (const label of ["Home", "Enquiries", "Content", "Media", "Account"]) {
          const tab = nav.getByRole("button", { name: label, exact: true });
          await tab.click();
          await expect(tab).toHaveAttribute("aria-current", "page");
          await expect(tab.locator("span")).toBeVisible();
          assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
          assert.equal(await tab.evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(255, 255, 255)");
          for (const inactive of await nav.locator("button:not([aria-current])").all()) {
            await expect(inactive.locator("span")).toBeHidden();
            assert.ok(await inactive.getAttribute("aria-label"));
          }
          for (const button of await nav.getByRole("button").all()) {
            const box = await button.boundingBox();
            assert.ok(box.width >= 44 && box.height >= 44);
          }
          const box = await nav.boundingBox();
          assert.ok(box.x >= 12 && box.x + box.width <= width - 12);
          assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 1);
          assert.ok(box.height >= 64 && box.height <= 72);
        }
        await nav.getByRole("button", { name: "Home", exact: true }).focus();
        await page.keyboard.press("Tab");
        const enquiries = nav.getByRole("button", { name: "Enquiries", exact: true });
        await expect(enquiries).toBeFocused();
        assert.equal(await enquiries.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
        assert.equal(await enquiries.evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
        await page.keyboard.press("Enter");
        await expect(enquiries).toHaveAttribute("aria-current", "page");
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(enquiries).toBeFocused();

        const menu = page.getByRole("button", { name: /^Menu/ });
        await menu.click();
        const drawer = page.getByRole("dialog", { name: "Travel With Ease menu" });
        await expect(drawer).toBeVisible();
        assert.equal(await nav.evaluate((node) => node.inert), true);
        for (const item of await drawer.getByRole("navigation").getByRole("button").all()) {
          assert.equal(await item.getAttribute("title"), null);
          const box = await item.boundingBox();
          assert.ok(box.width >= 120 && box.height >= 44);
        }
        const selected = drawer.locator('[aria-current="page"]');
        await selected.hover();
        assert.equal(
          await selected.evaluate((node) => getComputedStyle(node).color),
          "rgb(1, 12, 51)",
        );
        assert.equal(
          await selected.evaluate((node) => getComputedStyle(node).backgroundColor),
          "rgb(244, 237, 227)",
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(await drawer.evaluate((node) => node.contains(document.activeElement)), true);
        assert.equal(await drawer.getByRole("button", { name: "Templates", exact: true }).count(), 1);
        for (const label of ["Staff", "Activity"]) {
          assert.equal(await drawer.getByRole("button", { name: label, exact: true }).count(), role === "editor" ? 0 : 1);
        }
        assert.equal(await drawer.getByRole("button", { name: "System", exact: true }).count(), role === "platform_admin" ? 1 : 0);
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(menu).toBeFocused();
        await menu.click();
        await page.locator(".ui-erp-dialog-backdrop").click({ position: { x: width - 2, y: 880 } });
        await expect(drawer).toBeHidden();
        if (role !== "editor") {
          await menu.click();
          await drawer.getByRole("button", { name: "Activity", exact: true }).click();
          await expect(drawer).toBeHidden();
          assert.equal(await nav.locator("[aria-current]").count(), 0);
        }
        await nav.getByRole("button", { name: "Content", exact: true }).click();
        // Hold a failed autosave so a genuine dirty edit cannot disappear before confirmation.
        await page.route("**/api/agent/content/*/draft", (route) => route.fulfill({
          status: 503, json: { ok: false, error: { code: "service_unavailable", message: "Synthetic autosave failure" } },
        }));
        await page.getByLabel(/^Heading/).fill("Unsaved navigation test");
        await nav.getByRole("button", { name: "Home", exact: true }).click();
        const discardDialog = page.locator(".ui-erp-dialog-backdrop");
        await discardDialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(nav.getByRole("button", { name: "Content", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(page.getByLabel(/^Heading/)).toHaveValue("Unsaved navigation test");
        await nav.getByRole("button", { name: "Home", exact: true }).click();
        await page.locator(".ui-erp-dialog-backdrop")
          .getByRole("button", { name: "Discard and continue", exact: true }).click();
        await expect(nav.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
        assert.ok(await page.locator(".portal-shell > .ui-page-shell").evaluate((node) => parseFloat(getComputedStyle(node).paddingBottom) >= 100));
        // Content can finish rendering after navigation changes. Check the
        // final scrolled layout, not the first frame after scrollTo(), while
        // retaining the real minimum clearance requirement at every viewport.
        await expect.poll(async () => {
          await page.evaluate(() => {
            const scroller = document.scrollingElement || document.documentElement;
            scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
          });
          const tutorialEnd = await page.getByText("Help & tutorials", { exact: true }).boundingBox();
          const dock = await nav.boundingBox();
          return dock.y - (tutorialEnd.y + tutorialEnd.height);
        }, {
          message: "Help & tutorials must clear the fixed mobile navigation dock by at least 8px",
          timeout: 5000,
        }).toBeGreaterThanOrEqual(8);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (role === "owner") await page.screenshot({ path: path.join(output, `owner-${width}.png`) });
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${role} ${width}px`);
      await context.close();
    }
  }
  for (const signedIn of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
    await mockWorkspaceApi(page);
    await page.route("**/api/auth/session", (route) => route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn ? { ok: true, data: { user: { id: "restricted", role: "editor", permissions: [] }, csrfToken: "synthetic" } }
        : { ok: false, error: { code: "authentication_error", message: "Synthetic signed-out session" } },
    }));
    await page.goto(origin);
    if (signedIn) {
      const nav = page.getByRole("navigation", { name: "Workspace shortcuts" });
      await expect(nav).toBeVisible();
      assert.deepEqual(await nav.getByRole("button").allTextContents(), ["Home", "Account"]);
    } else {
      await page.getByRole("heading", { name: "Staff sign-in", exact: true }).waitFor();
      assert.equal(await page.locator(".twe-bottom-nav").count(), 0);
    }
    await page.close();
  }
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
