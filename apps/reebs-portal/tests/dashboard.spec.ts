import { expect, test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";

const adminUser = {
  id: 1,
  firstName: "Admin",
  lastName: "User",
  fullName: "Admin User",
  role: "admin",
  email: "admin@reebs.test",
};

const dashboard = {
  scope: { key: "REEBS_CORE", label: "REEBS Core", waterIncluded: false, consolidated: false },
  period: { key: "today", label: "Today", start: "2026-08-30T00:00:00.000Z", end: "2026-08-30T12:00:00.000Z" },
  generatedAt: "2026-08-30T12:00:00.000Z",
  freshness: { generatedAt: "2026-08-30T12:00:00.000Z", staleAfterSeconds: 300, refreshMode: "manual" },
  permissions: {
    canReadOrders: true,
    canWriteOrders: true,
    canReadBookings: true,
    canWriteBookings: true,
    canReadInventory: true,
    canConfigureInventory: true,
    canReadDelivery: true,
    canReadFinancials: true,
    canReadCustomers: true,
    canWriteCustomers: true,
    canReadWater: true,
    canViewSystemHealthDetail: true,
  },
  attention: [
    {
      id: "missing-price",
      severity: "warning",
      priority: 2,
      count: 11,
      label: "Pricing configuration needs attention",
      detail: "Active Core products do not have a positive selling price.",
      action: { label: "Configure prices", href: "/admin/inventory" },
    },
    {
      id: "reconciliation",
      severity: "warning",
      priority: 2,
      count: 2,
      label: "Financial reconciliation needed",
      detail: "Historical Core order subtotals differ from their saved line totals.",
      action: { label: "Review records", href: "/admin/orders?reconciliation=1" },
    },
  ],
  summary: {
    bookings: { today: 3, upcoming: 8, awaitingConfirmation: 1, completionDue: 0, inWindow: 3 },
    orders: { open: 4, inWindow: 2, outstandingCents: 14500, awaitingPayment: 2 },
    inventory: { activeProducts: 30, lowStock: 3, unavailable: 1, missingPrice: 11 },
    delivery: { today: 2, pending: 4, unassignedToday: 0 },
    payments: { receivedInWindowCents: 32000, mobileMoneyPayments: 2 },
  },
  activity: [
    {
      id: "order-1",
      kind: "order",
      summary: "Order payment recorded",
      reference: "ORD-20260830-001",
      status: "payment_recorded",
      createdAt: "2026-08-30T11:30:00.000Z",
      href: "/admin/orders/1",
    },
  ],
};

const installFixtures = async (page) => {
  await page.addInitScript((user) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, adminUser);
  await page.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    const payload = endpoint === "authSession"
      ? adminUser
      : endpoint === "dashboardOverview"
        ? dashboard
        : endpoint === "health"
          ? { ok: true, status: "ready", timestamp: "2026-08-30T12:00:00.000Z", dependencies: { database: "ready" } }
          : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
};

test("Core Dashboard is action-first, Water-separated and accessible", async ({ page }) => {
  test.setTimeout(120_000);
  await installFixtures(page);
  await page.goto("/admin");
  await expect(page).toHaveTitle(/^REEBS Portal — Dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Immediate Attention" })).toBeVisible();
  await expect(page.locator(".reebs-dashboard-eyebrow")).toHaveCount(0);
  await expect(page.getByText("Pricing configuration needs attention")).toBeVisible();
  await expect(page.getByText("Financial reconciliation needed")).toBeVisible();
  await expect(page.getByText("Water remains separate")).toBeVisible();
  await expect(page.getByText(/Water sales, revenue, costs, customers or profit/)).toBeVisible();
  await expect(page.getByText(/Water revenue/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Configure prices" })).toHaveAttribute("href", "/admin/inventory");
  await expect(page.getByRole("link", { name: "Review records" })).toHaveAttribute("href", "/admin/orders?reconciliation=1");
  await expect(page.getByRole("link", { name: /Bookings today/ })).toHaveAttribute("href", "/admin/bookings?timing=today");
  await expect(page.getByRole("link", { name: /Upcoming bookings/ })).toHaveAttribute("href", "/admin/bookings?timing=next7");
  await expect(page.getByRole("link", { name: /Open orders/ })).toHaveAttribute("href", "/admin/orders?status=open");
  await expect(page.getByRole("link", { name: /Outstanding payments/ })).toHaveAttribute("href", "/admin/orders?paymentStatus=unpaid");
  await expect(page.getByRole("link", { name: /Low stock/ })).toHaveAttribute("href", "/admin/inventory?stock=low&reorder=1");
  await expect(page.getByRole("link", { name: /Unavailable stock/ })).toHaveAttribute("href", "/admin/inventory?stock=out");
  await expect(page.getByRole("link", { name: "New Booking" })).toHaveAttribute("href", "/admin/bookings?action=create");
  await expect(page.getByRole("link", { name: "Record Payment" })).toHaveAttribute("href", "/admin/orders?paymentStatus=unpaid");
  await expect(page.locator(".reebs-dashboard-section.glass-card")).toHaveCount(5);
  await expect(page.locator(".reebs-dashboard-summary-card.bubble-card")).toHaveCount(8);
  const summaryBorderColors = await page.locator(".reebs-dashboard-summary-card").evaluateAll((cards) =>
    [...new Set(cards.map((card) => getComputedStyle(card).borderColor))]
  );
  expect(summaryBorderColors).toHaveLength(1);
  await expect(page.getByText("REEBS API")).toBeVisible();
  const financeCard = page.locator(".reebs-dashboard-summary-card.is-finance");
  const financeDetailBox = await financeCard.locator("small").boundingBox();
  const financeActionBox = await financeCard.locator(".reebs-dashboard-card-action").boundingBox();
  expect(financeDetailBox).not.toBeNull();
  expect(financeActionBox).not.toBeNull();
  expect((financeDetailBox?.y || 0) + (financeDetailBox?.height || 0)).toBeLessThanOrEqual(financeActionBox?.y || 0);
  await expect(financeCard.locator("strong")).toHaveCSS("white-space", "nowrap");
  if (process.env.CAPTURE_DASHBOARD === "1") {
    await page.screenshot({ path: "/tmp/reebs-dashboard-faako-desktop.png", fullPage: true });
  }
  await injectAxe(page);
  await checkA11y(page, ".reebs-dashboard-page", {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});

test("Dashboard cards inherit the active Faako light and dark themes", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/admin");
  const card = page.locator(".reebs-dashboard-summary-card").first();
  await expect(card).toBeVisible({ timeout: 30_000 });

  const light = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, borderColor: style.borderColor };
  });
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-admin-theme", "dark");
  });
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).color)).not.toBe(light.color);
  const dark = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, borderColor: style.borderColor };
  });

  expect(dark.color).not.toBe(light.color);
  expect(dark.borderColor).not.toBe(light.borderColor);
  await injectAxe(page);
  await checkA11y(page, ".reebs-dashboard-page", {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});

for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test(`Dashboard has no horizontal overflow at ${width}px`, async ({ page }) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    if (process.env.CAPTURE_DASHBOARD === "1" && width === 390) {
      await page.screenshot({ path: "/tmp/reebs-dashboard-faako-mobile.png", fullPage: true });
    }
    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
      page: (() => {
        const dashboardPage = document.querySelector(".reebs-dashboard-page");
        return dashboardPage ? dashboardPage.scrollWidth - dashboardPage.clientWidth : 0;
      })(),
    }));
    expect(overflow.html).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.page).toBeLessThanOrEqual(1);
    if (width <= 430) {
      const copyBox = await page.locator(".reebs-dashboard-header-copy").boundingBox();
      const actionsBox = await page.locator(".reebs-dashboard-header-actions").boundingBox();
      expect(copyBox).not.toBeNull();
      expect(actionsBox).not.toBeNull();
      expect((actionsBox?.y || 0) - ((copyBox?.y || 0) + (copyBox?.height || 0))).toBeLessThanOrEqual(32);
    }
    await expect(page.locator(".reebs-health-segments").first()).toBeVisible();
  });
}

test("ordinary staff do not receive financial or technical-detail widgets", async ({ page }) => {
  const staffUser = { ...adminUser, id: 2, role: "staff", email: "staff@reebs.test" };
  const staffDashboard = {
    ...dashboard,
    permissions: {
      ...dashboard.permissions,
      canReadFinancials: false,
      canConfigureInventory: false,
      canReadDelivery: false,
      canReadWater: false,
      canViewSystemHealthDetail: false,
    },
    attention: [],
    summary: { ...dashboard.summary, payments: null, delivery: null },
  };
  await page.addInitScript((user) => localStorage.setItem("reebs_auth_user", JSON.stringify(user)), staffUser);
  await page.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    const payload = endpoint === "authSession"
      ? staffUser
      : endpoint === "dashboardOverview"
        ? staffDashboard
        : { ok: true, status: "ready", timestamp: "2026-08-30T12:00:00.000Z", dependencies: { database: "ready" } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.goto("/admin");
  await expect(page.getByText("Payments received")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Record Payment" })).toHaveCount(0);
  await expect(page.getByText("REEBS API")).toHaveCount(0);
  await expect(page.getByText("System operational")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Water Business" })).toHaveCount(0);
});
