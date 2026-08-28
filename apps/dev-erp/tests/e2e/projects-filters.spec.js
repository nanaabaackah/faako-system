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

const project = {
  id: 42,
  title: "Client portal launch",
  clientName: "Acme Studio",
  projectType: "EXTERNAL",
  stage: "ACTIVE",
  priority: "URGENT",
  health: "AT_RISK",
  progressPercent: 60,
  currency: "CAD",
  budgetAmount: 5000,
  dueDate: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (url.pathname === "/api/auth/session") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ user: adminUser, csrfToken: "csrf-token" }) });
      return;
    }
    if (url.pathname === "/api/organizations") {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/api/projects") {
      const hasSearch = url.searchParams.has("search");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ projects: hasSearch ? [] : [project] }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });

  await page.addInitScript((user) => {
    window.localStorage.setItem("user", JSON.stringify(user));
  }, adminUser);
});

test("project filters combine server-side and clear back to the full board", async ({ page }) => {
  const chooseFilter = async (label, option) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const trigger = page.getByLabel(label);
      await trigger.click();
      const visibleOptions = page.locator('[role="listbox"]:visible');
      await expect(visibleOptions).toBeVisible();
      await visibleOptions.getByRole("option", { name: option, exact: true }).click();
      if ((await trigger.textContent())?.includes(option)) return;
      await page.waitForTimeout(150);
    }
    await expect(page.getByLabel(label)).toContainText(option);
  };

  await page.goto("/projects", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Client portal launch project details" })).toHaveAttribute("href", "/projects/42");

  await chooseFilter("Filter projects by stage", "Active");
  await chooseFilter("Filter projects by priority", "Urgent");
  await chooseFilter("Filter projects by health", "At risk");
  await chooseFilter("Filter projects by type", "External");
  await page.getByPlaceholder("Project or client").fill("Acme");

  const filteredResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/projects" && url.searchParams.get("search") === "Acme";
  });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const responseUrl = new URL((await filteredResponse).url());
  expect(responseUrl.searchParams.get("stage")).toBe("ACTIVE");
  expect(responseUrl.searchParams.get("priority")).toBe("URGENT");
  expect(responseUrl.searchParams.get("health")).toBe("AT_RISK");
  expect(responseUrl.searchParams.get("type")).toBe("EXTERNAL");
  await expect(page.getByRole("heading", { name: "No matching projects" })).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("link", { name: "View Client portal launch project details" })).toBeVisible();
  await expect(page.getByLabel("Filter projects by stage")).toContainText("All stages");
});

test("project filters fit within the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  await expect(page.getByPlaceholder("Project or client")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
