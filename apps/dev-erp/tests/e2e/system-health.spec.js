import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

const adminUser = {
  id: 1,
  userId: 1,
  fullName: "Admin User",
  email: "admin@example.com",
  roleName: "Admin",
  role: { name: "Admin", permissions: null },
};

const timeline = Array.from({ length: 48 }, (_, index) => ({
  id: index + 1,
  startedAt: new Date(Date.UTC(2026, 6, 11, 12, index)).toISOString(),
  status: index > 43 ? "DOWN" : "HEALTHY",
  latencyMs: 90 + index,
  httpStatus: index > 43 ? 503 : 200,
}));

const services = [
  {
    id: 1,
    key: "dev-erp-api",
    name: "Dev ERP API",
    category: "API",
    environment: "production",
    provider: "Railway",
    status: "DOWN",
    effectiveStatus: "DOWN",
    latencyMetrics: { current: 138, minimum: 82, maximum: 640, average: 174, p95: 530, trend: "up" },
    uptimePercentage: 98.8,
    lastCheckedAt: "2026-07-11T15:00:00.000Z",
    lastSuccessfulAt: "2026-07-11T14:55:00.000Z",
    lastFailedAt: "2026-07-11T15:00:00.000Z",
    dependencies: ["dev-erp-db"],
    incidents: [{ id: 17, status: "OPEN", summary: "Health endpoint unavailable", startedAt: "2026-07-11T14:58:00.000Z" }],
    timeline,
  },
  {
    id: 2,
    key: "dev-erp-db",
    name: "Dev ERP PostgreSQL",
    category: "DATABASE",
    environment: "production",
    provider: "Railway",
    status: "HEALTHY",
    effectiveStatus: "HEALTHY",
    latencyMetrics: { current: 42, minimum: 31, maximum: 78, average: 45, p95: 70, trend: "stable" },
    uptimePercentage: 100,
    lastCheckedAt: "2026-07-11T15:00:00.000Z",
    lastSuccessfulAt: "2026-07-11T15:00:00.000Z",
    dependencies: [],
    incidents: [],
    timeline: timeline.map((block) => ({ ...block, status: "HEALTHY", httpStatus: null, latencyMs: 42 })),
  },
];

const incident = {
  id: 17,
  title: "Dev ERP API unavailable",
  summary: "The production health endpoint is returning HTTP 503.",
  severity: "CRITICAL",
  status: "OPEN",
  startedAt: "2026-07-11T14:58:00.000Z",
  service: { id: 1, name: "Dev ERP API", environment: "production" },
  timeline: [{ id: 1, type: "DETECTED", summary: "Three checks failed.", createdAt: "2026-07-11T14:58:00.000Z", actorLabel: "Monitoring" }],
};

const fulfill = (route, body) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/auth/session") return fulfill(route, { user: adminUser, csrfToken: "csrf-token" });
    if (url.pathname === "/api/monitoring/summary") return fulfill(route, { summary: { score: 76, label: "Needs attention", coveragePercentage: 100, activeIncidents: 1 }, services, range: url.searchParams.get("range"), generatedAt: "2026-07-11T15:00:00.000Z" });
    if (url.pathname === "/api/monitoring/incidents/17") return fulfill(route, { incident });
    if (url.pathname === "/api/monitoring/incidents") return fulfill(route, { incidents: [incident] });
    if (url.pathname === "/api/monitoring/maintenance-windows") return fulfill(route, { maintenanceWindows: [] });
    if (url.pathname === "/api/monitoring/notifications") return fulfill(route, { notifications: [], unreadCount: 0 });
    if (url.pathname === "/api/monitoring/alert-rules") return fulfill(route, { alertRules: [] });
    if (url.pathname === "/api/monitoring/channels") return fulfill(route, { channels: [], providerStatus: { whatsapp: "disabled", webhook: "disabled" } });
    if (url.pathname === "/api/monitoring/escalation-policies") return fulfill(route, { escalationPolicies: [] });
    if (url.pathname === "/api/monitoring/responders") return fulfill(route, { users: [{ id: 1, fullName: "Admin User" }], roles: [{ id: 1, name: "Admin" }] });
    if (/^\/api\/monitoring\/services\/\d+\/run-check$/.test(url.pathname)) return fulfill(route, { check: { status: "HEALTHY" } });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });
});

test("system health controls, filters, timelines, and service drawer work", async ({ page }) => {
  await page.goto("/system-health", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "System health", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open details for Dev ERP API/ })).toBeVisible();

  await page.getByRole("tab", { name: "Alert rules" }).click();
  const adminLayout = await page.locator(".incident-admin-grid").evaluate((grid) => {
    const gridBounds = grid.getBoundingClientRect();
    const formBounds = grid.querySelector(".incident-admin-form").getBoundingClientRect();
    return { gridWidth: gridBounds.width, formWidth: formBounds.width };
  });
  expect(adminLayout.formWidth).toBeGreaterThan(adminLayout.gridWidth - 2);
  await page.getByRole("tab", { name: "Incidents" }).click();

  const rangeRequest = page.waitForRequest((request) => request.url().includes("/api/monitoring/summary?range=1h"));
  await page.getByRole("button", { name: "Last hour" }).click();
  await rangeRequest;

  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Healthy" }).click();
  await expect(page.getByRole("button", { name: /Open details for Dev ERP API/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open details for Dev ERP PostgreSQL/ })).toBeVisible();

  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "All statuses" }).click();
  await page.getByRole("button", { name: /Open details for Dev ERP API/ }).click();
  const serviceDialog = page.getByRole("dialog", { name: /Dev ERP API/ });
  await expect(serviceDialog).toBeVisible();
  await expect(serviceDialog.getByText("production · Railway", { exact: true })).toBeVisible();
});

test("emailed incident deep links open the matching incident", async ({ page }) => {
  await page.goto("/system-health?incident=17", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog", { name: "Dev ERP API unavailable" })).toBeVisible();
  await expect(page.getByText("Three checks failed.")).toBeVisible();
});

test("system health remains within the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/system-health", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "System health", exact: true })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});
