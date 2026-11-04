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
const output = await mkdtemp(path.join(tmpdir(), "twe-cms-management-"));
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
    const page = await context.newPage(),
      errors = [],
      requests = [];
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.goto(origin + "/?demo=1&demoRole=platform_admin");
    const visible = (name) =>
      page.getByRole("button", { name, exact: true }).filter({ visible: true });
    const navigate = async (name) => {
      if (!(await visible(name).count()))
        await page.getByRole("button", { name: /^Menu/ }).click();
      await visible(name).first().click();
    };
    await visible("Overview").first().waitFor();
    if (width <= 800) {
      const bottom = page.locator(".twe-bottom-nav");
      assert.deepEqual(await bottom.locator("button").allTextContents(), [
        "Content",
        "Enquiries",
        "Overview",
        "Media",
        "Account",
      ]);
      const menu = page.getByRole("button", { name: /^Menu/ });
      await menu.click();
      const drawer = page.getByRole("dialog", {
        name: "Travel With Ease menu",
      });
      await drawer.waitFor();
      await page.keyboard.press("Shift+Tab");
      assert.ok(
        await drawer.evaluate((node) => node.contains(document.activeElement)),
        "Drawer traps keyboard focus",
      );
      assert.equal(
        await page.locator(".ui-page-shell").evaluate((node) => node.inert),
        true,
      );
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden" });
      await page.waitForFunction(() =>
        document.activeElement?.textContent?.includes("Menu"),
      );
      await menu.click();
      await page
        .locator(".ui-erp-dialog-backdrop")
        .click({ position: { x: width - 2, y: 880 } });
      await drawer.waitFor({ state: "hidden" });
    } else {
      await visible("Collapse sidebar").click();
      await page.reload();
      await visible("Expand sidebar").waitFor();
      await visible("Expand sidebar").click();
    }
    await navigate("Staff");
    await page
      .getByRole("heading", { name: "Your team, with the right access" })
      .waitFor();
    await page
      .getByRole("button", { name: "Change role", exact: true })
      .first()
      .click();
    const confirmation = page.getByRole("alertdialog", {
      name: "Change staff role",
    });
    await confirmation.waitFor();
    assert.equal(
      await confirmation
        .getByRole("button", { name: "Confirm role change", exact: true })
        .isDisabled(),
      true,
    );
    await confirmation
      .getByLabel("Role change approval reference")
      .fill("DEMO-ROLE");
    await confirmation
      .getByRole("button", { name: "Confirm role change", exact: true })
      .click();
    await confirmation.waitFor({ state: "hidden" });
    await page.screenshot({
      path: path.join(output, `staff-${width}.png`),
      fullPage: true,
    });
    await navigate("Activity");
    await page
      .getByRole("heading", {
        name: "Workspace activity",
        exact: true,
        level: 2,
      })
      .waitFor();
    await page
      .getByText("staff · role changed", { exact: true })
      .filter({ visible: true })
      .waitFor();
    if (width <= 800)
      assert.equal(
        await page.locator(".twe-bottom-nav [aria-current]").count(),
        0,
        "Side-only pages must not highlight Overview",
      );
    await page
      .getByText("Details", { exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page
      .getByText("DEMO-ROLE", { exact: true })
      .filter({ visible: true })
      .waitFor();
    await page.screenshot({
      path: path.join(output, `activity-${width}.png`),
      fullPage: true,
    });
    await navigate("Content");
    await page
      .getByRole("heading", { name: "Images & layout", exact: true })
      .waitFor();
    await visible("Choose desktop image").click();
    await visible("Refresh Drive folder").click();
    await visible("Drive image").click();
    await page
      .getByRole("option", {
        name: "Demo photo — no Drive connection",
        exact: true,
      })
      .click();
    await page
      .getByRole("group", {
        name: "Import from the approved folder",
        exact: true,
      })
      .getByLabel(/^Alternative text/)
      .fill("Synthetic placement image");
    await visible("Import selected image").click();
    await visible("Use Synthetic placement image").click();
    await page.waitForFunction(() =>
      document
        .querySelector(".draft-save-status")
        ?.textContent.includes("Saved · version 2"),
    );
    await page.getByLabel("Desktop vertical focus").fill("25");
    await visible("Save draft").click();
    await visible("Preview saved content").click();
    await visible("Reset to approved image").click();
    await visible("Save draft").click();
    await navigate("System");
    await page
      .getByRole("heading", { name: "Security activity", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: path.join(output, `system-${width}.png`),
      fullPage: true,
    });
    await page.goto(origin + "/?demo=1&demoRole=editor");
    await visible("Overview").first().waitFor();
    if (width <= 800) await page.getByRole("button", { name: /^Menu/ }).click();
    for (const name of ["Staff", "Activity", "System"])
      assert.equal(await visible(name).count(), 0);
    assert.deepEqual(
      requests,
      [],
      "Synthetic demos must never call the backend",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    JSON.stringify({
      passed: true,
      widths: [320, 390, 768, 1440],
      screenshots: output,
      scope:
        "Role controls, placement drafts, activity, responsive navigation and keyboard",
    }),
  );
} finally {
  await browser.close();
}
