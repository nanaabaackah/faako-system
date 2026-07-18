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

const activeProject = {
  id: 42,
  organizationId: 1,
  title: "Archive workflow project",
  clientName: "Acme Studio",
  projectType: "EXTERNAL",
  stage: "ACTIVE",
  priority: "HIGH",
  health: "ON_TRACK",
  progressPercent: 60,
  currency: "CAD",
  budgetAmount: 5000,
  startDate: "2026-07-01T00:00:00.000Z",
  dueDate: "2026-08-01T00:00:00.000Z",
  description: "Archive verification",
  archivedAt: null,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

test("project archive and restore keep the record while updating active visibility", async ({ page }) => {
  let project = { ...activeProject };
  const archiveRequests = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
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
    if (url.pathname === "/api/projects" && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ projects: project.archivedAt ? [] : [project] }),
      });
      return;
    }
    if (url.pathname === "/api/projects/42" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(project) });
      return;
    }
    if (url.pathname === "/api/projects/42" && request.method() === "PATCH") {
      const body = request.postDataJSON();
      archiveRequests.push(body);
      project = {
        ...project,
        archivedAt: body.archived
          ? project.archivedAt || "2026-07-16T12:00:00.000Z"
          : null,
      };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(project) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });

  await page.addInitScript((user) => {
    window.localStorage.setItem("user", JSON.stringify(user));
  }, adminUser);

  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Archive project" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive project" }).click();
  await expect(page.getByText("Archived project", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit project" })).toHaveCount(0);
  expect(archiveRequests).toEqual([{ archived: true }]);

  await page.getByRole("button", { name: "Back to projects" }).click();
  await expect(page.getByRole("link", { name: "View Archive workflow project project details" })).toHaveCount(0);

  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Archived project", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore project" }).click();
  await expect(page.getByRole("button", { name: "Edit project" })).toBeVisible();
  expect(archiveRequests).toEqual([{ archived: true }, { archived: false }]);

  await page.getByRole("button", { name: "Back to projects" }).click();
  await expect(page.getByRole("link", { name: "View Archive workflow project project details" })).toBeVisible();
});
