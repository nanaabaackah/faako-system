import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

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
  organizationId: 1,
  title: "Task interface project",
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
  description: "Task UI verification",
  archivedAt: null,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

const initialTask = {
  id: 9,
  organizationId: 1,
  projectId: 42,
  title: "Initial task",
  description: "Existing delivery work",
  status: "IN_PROGRESS",
  priority: "HIGH",
  assigneeUserId: 1,
  assigneeUser: { id: 1, fullName: "Admin User", email: "admin@example.com" },
  startDate: "2026-07-01T00:00:00.000Z",
  dueDate: "2026-07-20T00:00:00.000Z",
  completedAt: null,
  archivedAt: null,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

const installTaskApi = async (page, { initialTasks = [initialTask], failStatus = "" } = {}) => {
  let tasks = initialTasks.map((task) => ({ ...task }));
  const writes = [];
  let activityId = 1;
  let trelloConnection = null;
  let activity = [{
    id: activityId,
    action: "PROJECT_CREATED",
    summary: "Created project Task interface project.",
    actor: { userId: 1, label: "Admin User" },
    projectId: 42,
    task: null,
    createdAt: "2026-07-16T09:00:00.000Z",
  }];

  const addTaskActivity = (action, summary, task) => {
    activityId += 1;
    activity = [{
      id: activityId,
      action,
      summary,
      actor: { userId: 1, label: "Admin User" },
      projectId: 42,
      task: { id: task.id, title: task.title },
      createdAt: `2026-07-16T10:${String(activityId).padStart(2, "0")}:00.000Z`,
    }, ...activity];
  };

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
    if (url.pathname === "/api/projects/42" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(project) });
      return;
    }
    if (url.pathname === "/api/projects/42/task-assignees") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ assignees: [{ id: 1, fullName: "Admin User", email: "admin@example.com" }] }),
      });
      return;
    }
    if (url.pathname === "/api/projects/42/activity" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ activity }) });
      return;
    }
    if (url.pathname === "/api/projects/42/trello" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ connection: trelloConnection, recentErrors: [] }) });
      return;
    }
    if (url.pathname === "/api/projects/42/trello/discover" && request.method() === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        board: { id: "board-1", name: "Delivery Board", url: "https://trello.com/b/board-1" },
        lists: [
          { id: "list-backlog", name: "Backlog" },
          { id: "list-todo", name: "To do" },
          { id: "list-progress", name: "In progress" },
          { id: "list-review", name: "Review" },
          { id: "list-blocked", name: "Blocked" },
          { id: "list-done", name: "Done" },
        ],
      }) });
      return;
    }
    if (url.pathname === "/api/projects/42/trello/connection" && request.method() === "PATCH") {
      const body = request.postDataJSON();
      trelloConnection = {
        id: 3,
        organizationId: 1,
        boardId: "board-1",
        boardName: "Delivery Board",
        boardUrl: "https://trello.com/b/board-1",
        statusMappings: body.statusMappings,
        status: "ACTIVE",
        webhookConfigured: true,
        webhookId: "webhook-1",
        lastSyncAt: null,
        lastError: null,
      };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ connection: trelloConnection, webhookError: null }) });
      return;
    }
    if (/^\/api\/projects\/42\/trello\/tasks\/\d+\/sync$/.test(url.pathname) && request.method() === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ synced: Boolean(trelloConnection), skipped: !trelloConnection }) });
      return;
    }
    if (url.pathname === "/api/projects/42/tasks" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ tasks }) });
      return;
    }
    if (url.pathname === "/api/projects/42/tasks" && request.method() === "POST") {
      const body = request.postDataJSON();
      writes.push({ operation: "create", body });
      const created = {
        ...initialTask,
        ...body,
        id: 10,
        assigneeUser: body.assigneeUserId ? { id: 1, fullName: "Admin User", email: "admin@example.com" } : null,
        completedAt: body.status === "DONE" ? "2026-07-16T12:00:00.000Z" : null,
      };
      tasks = [...tasks, created];
      addTaskActivity("TASK_CREATED", `Created task ${created.title}.`, created);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
      return;
    }

    const statusMatch = url.pathname.match(/^\/api\/projects\/42\/tasks\/(\d+)\/status$/);
    if (statusMatch && request.method() === "PATCH") {
      const taskId = Number(statusMatch[1]);
      const body = request.postDataJSON();
      if (body.status === failStatus) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Status save failed." }) });
        return;
      }
      writes.push({ operation: "status", taskId, body });
      tasks = tasks.map((task) => task.id === taskId
        ? { ...task, status: body.status, completedAt: body.status === "DONE" ? "2026-07-16T12:00:00.000Z" : null }
        : task);
      const updatedTask = tasks.find((task) => task.id === taskId);
      addTaskActivity(
        body.status === "DONE" ? "TASK_COMPLETED" : "TASK_STATUS_CHANGED",
        body.status === "DONE" ? `Completed task ${updatedTask.title}.` : `Moved task ${updatedTask.title}.`,
        updatedTask
      );
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(updatedTask) });
      return;
    }

    const archiveMatch = url.pathname.match(/^\/api\/projects\/42\/tasks\/(\d+)\/archive$/);
    if (archiveMatch && request.method() === "PATCH") {
      const taskId = Number(archiveMatch[1]);
      const body = request.postDataJSON();
      writes.push({ operation: "archive", taskId, body });
      const archived = { ...tasks.find((task) => task.id === taskId), archivedAt: "2026-07-16T12:00:00.000Z" };
      addTaskActivity("TASK_ARCHIVED", `Archived task ${archived.title}.`, archived);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(archived) });
      return;
    }

    const taskMatch = url.pathname.match(/^\/api\/projects\/42\/tasks\/(\d+)$/);
    if (taskMatch && request.method() === "PATCH") {
      const taskId = Number(taskMatch[1]);
      const body = request.postDataJSON();
      writes.push({ operation: "update", taskId, body });
      tasks = tasks.map((task) => task.id === taskId ? { ...task, ...body } : task);
      const updatedTask = tasks.find((task) => task.id === taskId);
      addTaskActivity("TASK_UPDATED", `Updated task ${updatedTask.title}.`, updatedTask);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(updatedTask) });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });

  await page.addInitScript((user) => {
    window.localStorage.setItem("user", JSON.stringify(user));
  }, adminUser);

  return writes;
};

const chooseDropdown = async (page, label, option, scope = page) => {
  const trigger = scope.getByRole("button", { name: label, exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();

  // SelectField renders its listbox in a document-level portal.
  const optionLocator = page.getByRole("option", { name: option, exact: true });
  await expect(optionLocator).toBeVisible();
  await optionLocator.click();
  await expect(trigger).toContainText(option);
};

test("project detail creates, assigns, edits, completes, and archives tasks", async ({ page }) => {
  const writes = await installTaskApi(page);
  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Initial task" })).toBeVisible();
  await expect(page.locator(".project-task-row")).toContainText("Assignee: Admin User");

  await page.getByRole("button", { name: "New task" }).click();
  const createDialog = page.getByRole("dialog", { name: "New task" });
  await createDialog.getByLabel("Title").fill("Design QA");
  await chooseDropdown(page, "Assignee", "Admin User", createDialog);
  await createDialog.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByRole("heading", { name: "Design QA" })).toBeVisible();
  expect(writes[0]).toMatchObject({ operation: "create", body: { title: "Design QA", assigneeUserId: 1 } });

  await page.getByRole("button", { name: "Edit Design QA" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit task" });
  await editDialog.getByLabel("Title").fill("Design QA review");
  await editDialog.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByRole("heading", { name: "Design QA review" })).toBeVisible();

  await chooseDropdown(page, "Status for Design QA review", "Done");
  await expect(page.getByLabel("Status for Design QA review")).toContainText("Done");
  expect(writes.some((write) => write.operation === "status" && write.body.status === "DONE")).toBe(true);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive Design QA review" }).click();
  await expect(page.getByRole("heading", { name: "Design QA review" })).toHaveCount(0);
  expect(writes.some((write) => write.operation === "archive" && write.body.archived === true)).toBe(true);
});

test("project task list remains within the mobile viewport", async ({ page }) => {
  await installTaskApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await page.getByRole("button", { name: "Board" }).click();
  await expect(page.getByLabel("Project task board")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("project task list shows a useful empty state", async ({ page }) => {
  await installTaskApi(page, { initialTasks: [] });
  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("No active tasks", { exact: true })).toBeVisible();
  await expect(page.getByText("Create the first task for this project.")).toBeVisible();
});

test("task board moves tasks, stays consistent with the list, and rolls back failed updates", async ({ page }) => {
  const writes = await installTaskApi(page, { failStatus: "BLOCKED" });
  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Board" }).click();
  const board = page.getByLabel("Project task board");
  await expect(board).toBeVisible();
  await expect(board.getByRole("heading", { name: "Backlog", exact: true })).toBeVisible();
  await expect(board.getByRole("heading", { name: "Done", exact: true })).toBeVisible();

  const reviewColumn = page.locator(".project-task-column").filter({ has: page.getByRole("heading", { name: "Review", exact: true }) });
  await chooseDropdown(page, "Move Initial task", "Move to Review");
  await expect(reviewColumn.getByRole("heading", { name: "Initial task" })).toBeVisible();
  expect(writes.some((write) => write.operation === "status" && write.body.status === "REVIEW")).toBe(true);

  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByLabel("Status for Initial task")).toContainText("Review");
  await page.getByRole("button", { name: "Board" }).click();

  await page.getByLabel("Move Initial task").click();
  await page.getByRole("option", { name: "Move to Blocked", exact: true }).click({ force: true });
  await expect(page.getByRole("alert")).toContainText("returned to Review");
  await expect(reviewColumn.getByRole("heading", { name: "Initial task" })).toBeVisible();
  expect(writes.some((write) => write.operation === "status" && write.body.status === "BLOCKED")).toBe(false);
});

test("project detail shows recent activity and refreshes after a task change", async ({ page }) => {
  await installTaskApi(page);
  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await expect(page.getByText("Created project Task interface project.")).toBeVisible();

  await chooseDropdown(page, "Status for Initial task", "Done");
  const timeline = page.getByLabel("Recent project activity");
  const completionEntry = timeline.locator(".project-activity-entry", {
    hasText: "Completed task Initial task.",
  });
  await expect(completionEntry).toBeVisible();
  await expect(completionEntry.getByText("Admin User", { exact: true })).toBeVisible();
  await expect(completionEntry.getByText("Task #9", { exact: true })).toBeVisible();
});

test("administrator connects a Trello board and maps all task statuses", async ({ page }) => {
  await installTaskApi(page);
  await page.goto("/projects/42", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Connect Trello" }).click();
  await page.getByLabel("API key").fill("api-key");
  await page.getByLabel("API token").fill("api-token");
  await page.getByLabel("Application secret").fill("app-secret");
  await page.getByLabel("Board ID").fill("board-1");
  await page.getByRole("button", { name: "Load board lists" }).click();
  await expect(page.getByText("Loaded Delivery Board.")).toBeVisible();

  const mappings = [
    ["Backlog", "Backlog"],
    ["To do", "To do"],
    ["In progress", "In progress"],
    ["Review", "Review"],
    ["Blocked", "Blocked"],
    ["Done", "Done"],
  ];
  for (const [label, option] of mappings) {
    await chooseDropdown(page, label, option);
  }
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByRole("link", { name: /Delivery Board/ })).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
});
