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

const dashboardPayload = {
  lastSyncedAt: "2026-07-11T15:00:00.000Z",
  status: {
    api: "offline",
    portfolioDb: "ok",
    reebsDb: "error",
    faakoDb: "ok",
    stroaneDb: "ok",
  },
  apiSurfaces: [
    {
      id: "dev-erp-api",
      label: "Dev ERP API",
      status: "offline",
      note: "0/2 endpoints online | 2 offline",
      category: "api",
      configured: true,
      baseUrl: "https://api.dev.example.com",
      pages: [
        {
          label: "Health",
          path: "/healthz",
          url: "https://api.dev.example.com/healthz",
          finalUrl: "https://api.dev.example.com/healthz",
          status: "offline",
          httpStatus: 503,
          responseTimeMs: 94,
          checkedAt: "2026-07-11T15:00:00.000Z",
          errorType: "http_error",
        },
      ],
    },
  ],
  siteStatus: {
    checkedAt: "2026-07-11T15:00:00.000Z",
    sites: [
      {
        id: "stroane-web",
        title: "stroanesolutions.com",
        category: "client",
        baseUrl: "https://stroanesolutions.com",
        pages: [
          {
            label: "Home",
            path: "/",
            url: "https://stroanesolutions.com/",
            status: "online",
            httpStatus: 200,
            responseTimeMs: 120,
            checkedAt: "2026-07-11T15:00:00.000Z",
          },
          {
            label: "Checkout return",
            path: "/checkout/return",
            url: "https://stroanesolutions.com/checkout/return",
            status: "degraded",
            httpStatus: 404,
            responseTimeMs: 88,
            checkedAt: "2026-07-11T15:00:00.000Z",
            errorType: "http_error",
          },
        ],
      },
      {
        id: "portfolio",
        title: "nanaabaackah.com",
        category: "portfolio",
        baseUrl: "https://nanaabaackah.com",
        pages: [
          {
            label: "Home",
            path: "/",
            url: "https://nanaabaackah.com/",
            status: "online",
            httpStatus: 200,
            responseTimeMs: 72,
            checkedAt: "2026-07-11T15:00:00.000Z",
          },
        ],
      },
    ],
  },
};

const aiPayload = {
  diagnosis: {
    executiveSummary: "The API is reachable but its health route is returning a server error.",
    likelyCause: "A failed deployment, database connection, or pending migration is preventing startup.",
    impact: "Authenticated Dev ERP workflows may fail until the API recovers.",
    confidence: "medium",
    actions: [
      { title: "Inspect Railway logs", instruction: "Find the first startup exception around the check time.", urgency: "now" },
      { title: "Check migrations", instruction: "Confirm pending Prisma migrations completed successfully.", urgency: "next" },
    ],
    verificationSteps: ["Confirm /healthz returns HTTP 200.", "Reload the affected Dev ERP workflow."],
    escalation: "Escalate if the service still returns 503 after a clean restart or rollback.",
  },
  model: "gpt-test",
  createdAt: "2026-07-11T15:01:00.000Z",
};

test.beforeEach(async ({ page }) => {
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
    if (url.pathname === "/api/dashboard") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(dashboardPayload) });
      return;
    }
    if (url.pathname === "/api/ai/system-health-diagnosis" && request.method() === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(aiPayload) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not mocked" }) });
  });
});

test("system health explains incidents and returns an AI runbook", async ({ page }) => {
  await page.goto("/system-health", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "System health", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Service interruption detected" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Dev ERP API/ })).toBeVisible();
  await expect(page.getByText(/HTTP 503/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recovery runbook" })).toBeVisible();

  await page.getByRole("button", { name: "Analyze with AI" }).click();
  await expect(page.getByRole("heading", { name: "AI operational assessment" })).toBeVisible();
  await expect(page.getByText("Inspect Railway logs")).toBeVisible();
  await expect(page.getByText(/Confirm \/healthz returns HTTP 200/)).toBeVisible();
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
