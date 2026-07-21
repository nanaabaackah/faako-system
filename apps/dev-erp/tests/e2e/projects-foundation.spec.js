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

const existingProject = {
  id: 42,
  organizationId: 1,
  title: "Foundation project",
  clientName: "Acme Studio",
  projectType: "EXTERNAL",
  stage: "ACTIVE",
  priority: "HIGH",
  health: "AT_RISK",
  progressPercent: 45,
  currency: "CAD",
  budgetAmount: 5000,
  startDate: "2026-07-01T00:00:00.000Z",
  dueDate: "2026-08-01T00:00:00.000Z",
  description: "Foundation verification",
  externalRef: null,
  archivedAt: null,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

const installProjectApi = async (page) => {
  let projects = [{ ...existingProject }];
  const writes = [];

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
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ projects }) });
      return;
    }
    if (url.pathname === "/api/projects" && request.method() === "POST") {
      const body = request.postDataJSON();
      writes.push({ method: "POST", body });
      const created = {
        ...existingProject,
        ...body,
        id: 43,
        organizationId: 1,
        archivedAt: null,
        createdAt: "2026-07-16T12:00:00.000Z",
        updatedAt: "2026-07-16T12:00:00.000Z",
      };
      projects = [created, ...projects];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
      return;
    }
    const detailMatch = url.pathname.match(/^\/api\/projects\/(\d+)$/);
    if (detailMatch && request.method() === "GET") {
      const project = projects.find((item) => item.id === Number(detailMatch[1]));
      await route.fulfill({
        status: project ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(project || { error: "Project not found." }),
      });
      return;
    }
    if (detailMatch && request.method() === "PATCH") {
      const projectId = Number(detailMatch[1]);
      const body = request.postDataJSON();
      writes.push({ method: "PATCH", projectId, body });
      projects = projects.map((project) =>
        project.id === projectId
          ? { ...project, ...body, updatedAt: "2026-07-16T13:00:00.000Z" }
          : project
      );
      const updated = projects.find((project) => project.id === projectId);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(updated) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });

  await page.addInitScript((user) => {
    window.localStorage.setItem("user", JSON.stringify(user));
  }, adminUser);

  return writes;
};

test("project list creates a project with foundation defaults", async ({ page }) => {
  const writes = await installProjectApi(page);
  await page.goto("/projects", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("link", { name: "View Foundation project project details" })).toBeVisible();
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel("Title").fill("New client portal");
  await dialog.getByLabel("Client name").fill("Northwind");
  await dialog.getByLabel("Progress").fill("20");
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(page.getByRole("link", { name: "View New client portal project details" })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    method: "POST",
    body: {
      title: "New client portal",
      clientName: "Northwind",
      projectType: "PERSONAL",
      stage: "BACKLOG",
      priority: "MEDIUM",
      progressPercent: 20,
      health: "ON_TRACK",
    },
  });
  expect("ownerUserId" in writes[0].body).toBe(false);
});

test("project detail displays saved fields and updates through the shared form", async ({ page }) => {
  const writes = await installProjectApi(page);
  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Foundation project" })).toBeVisible();
  await expect(page.getByText("45% complete")).toBeVisible();
  await expect(page.getByText("At risk", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Jul 1, 2026").first()).toBeVisible();

  await page.getByRole("button", { name: "Edit project" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit project" });
  await dialog.getByLabel("Progress").fill("75");
  await dialog.getByRole("button", { name: "Save project" }).click();

  await expect(page.getByText("75% complete")).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    method: "PATCH",
    projectId: 42,
    body: { progressPercent: 75, health: "AT_RISK" },
  });
});
