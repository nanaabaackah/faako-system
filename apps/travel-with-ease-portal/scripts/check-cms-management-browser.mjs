import { navigateWorkspace } from "./navigate-workspace.mjs";
import { mockWorkspaceApi } from "../test/fixtures/browser-api.js";
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
    await mockWorkspaceApi(page, {role: "platform_admin", requests});
    await page.goto(origin + "/");
    const visible = (name) =>
      page.getByRole("button", { name, exact: true }).filter({ visible: true });
    const navigate = name => navigateWorkspace(page, name);
    await visible(width <= 900 ? "Home" : "Overview").first().waitFor();
    if (width <= 900) {
      const bottom = page.locator(".twe-bottom-nav");
      assert.deepEqual(await bottom.locator("button").allTextContents(), [
        "Home",
        "Enquiries",
        "Content",
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
      await visible("Collapse navigation").click();
      await page.reload();
      await visible("Expand navigation").waitFor();
      await visible("Expand navigation").click();
    }
    await navigate("Staff");
    await page
      .getByRole("heading", { name: "Staff accounts", exact: true })
      .waitFor();
    const staffRow = page.locator(".twe-admin-staff-row").filter({hasText:"demo-editor"}).first();
    await staffRow.click();
    assert.equal(await staffRow.getAttribute("aria-expanded"), "true");
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
    if (width <= 900)
      assert.equal(
        await page.locator(".twe-bottom-nav [aria-current]").count(),
        0,
        "Side-only pages must not highlight Overview",
      );
    const activityRecord = page.locator(".twe-activity-record").filter({hasText:"staff · role changed"}).first();
    await activityRecord.locator("summary").click();
    assert.equal(await activityRecord.evaluate(node => node.open), true);
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
    await page.getByRole("button", { name: /^Demo photo — no Drive connection/ }).click();
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
    await page.unroute("**/api/**");
    await mockWorkspaceApi(page, {role: "editor", requests});
    await page.goto(origin);
    await visible(width <= 900 ? "Home" : "Overview").first().waitFor();
    if (width <= 900) await page.getByRole("button", { name: /^Menu/ }).click();
    for (const name of ["Staff", "Activity", "System", "Administration", "Staff access", "System administration"])
      assert.equal(await visible(name).count(), 0);
    assert.ok(requests.length > 0, "Actual API client exercised against isolated HTTP fixtures");
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
