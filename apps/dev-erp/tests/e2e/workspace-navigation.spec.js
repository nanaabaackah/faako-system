import { expect, test } from "@playwright/test";

const adminUser = {
  id: 1,
  userId: 1,
  fullName: "Admin User",
  email: "admin@example.com",
  organizationId: 1,
  roleName: "Admin",
  role: { name: "Admin", permissions: null },
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/session") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ user: adminUser, csrfToken: "csrf-token" }),
      });
      return;
    }
    if (url.pathname === "/api/organizations") {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/api/projects") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ projects: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });
  await page.addInitScript((user) => {
    window.localStorage.setItem("user", JSON.stringify(user));
  }, adminUser);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const diagnostics = await page.evaluate(() => ({
    pathname: location.pathname,
    appShellCount: document.querySelectorAll(".erp-shell").length,
    mainRailCount: document.querySelectorAll(".erp-sidebar__rail").length,
    bodyText: document.body?.innerText?.slice(0, 600),
    storedUser: Boolean(localStorage.getItem("user")),
    navState: document.querySelector(".erp-sidebar__rail-nav")?.getAttribute("aria-label"),
  })).catch((error) => ({ error: String(error) }));
  console.log("DEV_ERP_NAV_DIAGNOSTICS", JSON.stringify(diagnostics));
});

test("main navigation expands independently of the active module submenu", async ({ page }) => {
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  const mainNav = page.getByRole("navigation", { name: "Main module navigation" });
  const contextualNav = page.getByRole("navigation", { name: "Projects sections" });
  await expect(mainNav.getByRole("link", { name: "Projects" })).toBeVisible();
  await expect(contextualNav).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Projects sections" }).getByRole("link", { name: "Board" })).toBeVisible();

  const mainRail = page.locator(".erp-sidebar__rail");
  expect(await mainRail.evaluate((node) => getComputedStyle(node).borderTopStyle)).toBe("none");

  await page.getByRole("button", { name: "Collapse main menu" }).click();
  await expect(mainNav.getByRole("link", { name: "Projects" })).toBeVisible();
  await expect(contextualNav).toBeVisible();
  await expect(page.locator(".erp-shell")).toHaveClass(/is-main-menu-collapsed/);

  await page.getByRole("button", { name: "Expand main menu" }).click();
  await expect(mainNav.getByText("Projects", { exact: true })).toBeVisible();
  await expect(page.locator(".erp-shell")).not.toHaveClass(/is-main-menu-collapsed/);
});

test("standalone modules do not render the contextual submenu", async ({ page }) => {
  await page.goto("/faako-onboarding", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "Main module navigation" })).toBeVisible();
  await expect(page.locator(".erp-sidebar__context-nav")).toHaveCount(0);
  await expect(page.locator(".erp-shell")).not.toHaveClass(/has-contextual-submenu/);
  const columns = await page.locator(".erp-workspace-frame").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  const widths = columns.split(" ").map((value) => Number.parseFloat(value));
  expect(widths[0]).toBeLessThanOrEqual(1);
  expect(widths[1]).toBeGreaterThan(0);
});

test("mobile keeps the overlay module navigation and contextual links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Projects sections" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "All admin modules" })).toBeVisible();
});
