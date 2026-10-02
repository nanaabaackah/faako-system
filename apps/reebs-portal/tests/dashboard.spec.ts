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
  period: { key: "30d", label: "Last 30 days", start: "2026-08-01T00:00:00.000Z", end: "2026-08-30T12:00:00.000Z" },
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
    payments: { receivedInWindowCents: 32000, mobileMoneyPayments: 2, paymentCount: 4,
      series: Array.from({ length: 8 }, (_, index) => ({
        start: new Date(Date.UTC(2026, 7, 1) + index * 29.5 * 86400000 / 8).toISOString(),
        end: new Date(Date.UTC(2026, 7, 1) + (index + 1) * 29.5 * 86400000 / 8).toISOString(),
        amountCents: index % 2 ? 8000 : 0,
      })), comparison: { previousCents: 16000, changePercent: 100 } },
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

const installFixtures = async (page, sessionUser = adminUser) => {
  await page.addInitScript((user) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, sessionUser);
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    const payload = ["authSession", "session"].includes(endpoint || "")
      ? sessionUser
      : endpoint === "dashboardOverview"
        ? dashboard
        : endpoint === "health"
          ? { ok: true, status: "ready", timestamp: "2026-08-30T12:00:00.000Z", dependencies: { database: "ready" } }
          : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
};

for (const width of [375, 1440]) {
  test(`Dashboard action labels follow the portal standard at ${width}px`, async ({ page }) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Operational snapshot" })).toBeVisible();
    const refresh = page.getByRole("button", { name: "Refresh dashboard", exact: true });
    const add = page.getByRole("link", { name: "New Booking", exact: true });
    const open = page.getByRole("link", { name: "Open ORD-20260830-001", exact: true });
    await expect(add.locator(".portal-action__label")).toBeHidden();
    await expect(open.locator(".portal-action__label")).toBeHidden();
    if (width < 768) await expect(refresh.locator(".portal-action__label")).toBeHidden();
    else await expect(refresh.locator(".portal-action__label")).toBeVisible();
    for (const control of [refresh, add, open]) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      const appearance = await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return { radius: parseFloat(style.borderTopLeftRadius), background: style.backgroundColor };
      });
      expect(appearance.radius).toBeGreaterThanOrEqual(22);
      expect(appearance.background).not.toBe("rgba(0, 0, 0, 0)");
    }
  });
}

test("loading retains Faako card surfaces and respects reduced motion", async ({ page }) => {
  await installFixtures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route((url) => url.pathname.endsWith("/dashboardOverview"), async (route) => {
    await pending;
    await route.fulfill({ json: dashboard });
  });
  await page.goto("/admin");
  try {
    const skeleton = page.getByRole("status", { name: "Loading Core operations" });
    await expect(skeleton).toBeVisible();
    await expect(skeleton.locator(".bubble-card")).toHaveCount(4);
    await expect(skeleton.locator(".glass-card")).toHaveCount(4);
    const duration = await skeleton.locator(".ui-animated-loading-state__skeleton-line").first().evaluate((element) => getComputedStyle(element, "::after").animationDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
  } finally { release(); }
  await expect(page.getByRole("heading", { name: "Core collections" })).toBeVisible();
});

test("refresh errors retain labelled data and retry recovers", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Core collections" })).toBeVisible();
  let fail = true;
  await page.route((url) => url.pathname.endsWith("/dashboardOverview"), (route) => fail
    ? route.fulfill({ status: 503, json: { error: "The service is temporarily unavailable." } })
    : route.fulfill({ json: dashboard }));
  await page.getByRole("button", { name: "Refresh dashboard", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Showing the last successful dashboard");
  await expect(page.getByRole("alert")).toContainText("Displayed period: Last 30 days");
  await expect(page.getByRole("heading", { name: "Core collections" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("activity is sortable, paginated and readable in a mobile scroll region", async ({ page }) => {
  await installFixtures(page);
  await page.setViewportSize({ width: 320, height: 960 });
  await page.route((url) => url.pathname.endsWith("/dashboardOverview"), (route) => route.fulfill({ json: {
    ...dashboard, activity: Array.from({ length: 8 }, (_, index) => ({ ...dashboard.activity[0], id: `order-${index}`, reference: `ORD-00${index}`, createdAt: new Date(Date.UTC(2026, 7, 30, index)).toISOString() })),
  } }));
  await page.goto("/admin");
  const section = page.locator(".reebs-dashboard-activity");
  await expect(section.getByText("Showing 1-5 of 8")).toBeVisible();
  await section.getByRole("button", { name: "Sort by Record", exact: true }).click();
  await expect(section.locator("tbody tr").first()).toContainText("ORD-000");
  await expect(section.getByRole("columnheader", { name: "Sort by Record" })).toHaveAttribute("aria-sort", "ascending");
  await section.getByRole("button", { name: "Next", exact: true }).click();
  await expect(section.getByText("Showing 6-8 of 8")).toBeVisible();
  const region = section.getByRole("region", { name: "Recent activity table" });
  await region.focus();
  await expect(region).toBeFocused();
  expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("date selection changes the overview request and a failed section remains visibly unavailable", async ({ page }) => {
  await installFixtures(page);
  await page.route((url) => url.pathname.endsWith("/dashboardOverview"), async (route) => {
    const key = new URL(route.request().url()).searchParams.get("window");
    await route.fulfill({ json: { ...dashboard,
      period: { ...dashboard.period, key, label: key === "7d" ? "Last 7 days" : "Last 30 days" },
      unavailable: ["payments", "order activity"], summary: { ...dashboard.summary, payments: null }, activity: [],
    } });
  });
  await page.goto("/admin");
  await expect(page.getByText("Collections are unavailable. No estimated total is shown.")).toBeVisible();
  const request = page.waitForRequest((req) => req.url().includes("dashboardOverview") && req.url().includes("window=7d"));
  await page.getByRole("button", { name: "Summary period", exact: true }).click();
  await page.getByRole("option", { name: "Last 7 days", exact: true }).click();
  await request;
  await expect(page.getByText("Payments received · Last 7 days · GHS")).toBeVisible();
  await expect(page.getByText("Activity could not be fully loaded.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry collections" })).toBeVisible();
});

test("an empty period is not represented as a failed service", async ({ page }) => {
  await installFixtures(page);
  await page.route((url) => url.pathname.endsWith("/dashboardOverview"), (route) => route.fulfill({ json: {
    ...dashboard, activity: [], attention: [], summary: { ...dashboard.summary,
      payments: { ...dashboard.summary.payments, receivedInWindowCents: 0, series: dashboard.summary.payments.series.map((point) => ({ ...point, amountCents: 0 })), comparison: null },
    },
  } }));
  await page.goto("/admin");
  await expect(page.getByText("No Core payments received in this period.")).toBeVisible();
  await expect(page.getByText("No Core activity in this period for your role.")).toBeVisible();
  await expect(page.getByText("No urgent actions.", { exact: true })).toBeVisible();
});

for (const [role, expected] of [
  ["warehouse", ["Home", "Stock", "POS"]],
  ["manager", ["Home", "Stock", "POS", "Payments"]],
  ["water", ["Water"]],
  ["driver", ["Home", "Bookings", "Delivery", "Customers"]],
] as const) {
  test(`Quick Access respects the ${role} role without adding destinations`, async ({ page }) => {
    await installFixtures(page, { ...adminUser, role });
    await page.goto("/admin/profile");
    const nav = page.getByRole("navigation", { name: "Quick access" });
    await expect(nav.getByRole("link")).toHaveText([...expected]);
  });
}

test("Core Dashboard follows the approved layout, preserves Sidecar and separates Water", async ({ page }) => {
  test.setTimeout(120_000);
  await installFixtures(page);
  await page.goto("/admin");
  await expect(page).toHaveTitle(/^REEBS Portal — Dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back, Admin" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Core collections" })).toBeVisible();
  await expect(page.locator(".reebs-dashboard-eyebrow")).toHaveCount(0);
  await expect(page.getByText("Water remains separate")).toBeVisible();
  await expect(page.getByRole("link", { name: /Bookings in period/ })).toHaveAttribute("href", "/admin/bookings");
  await expect(page.getByRole("link", { name: /Open orders/ })).toHaveAttribute("href", "/admin/orders?status=open");
  await expect(page.getByRole("link", { name: /Outstanding balance/ })).toHaveAttribute("href", "/admin/orders?paymentStatus=unpaid");
  await expect(page.getByRole("link", { name: /Payments received.*Core cash receipts/ })).toHaveAttribute("href", "/admin/payments");
  await expect(page.getByRole("link", { name: "New Booking", exact: true })).toHaveAttribute("href", "/admin/bookings?action=create");
  await expect(page.locator(".reebs-dashboard-summary-card.bubble-card")).toHaveCount(4);
  await expect(page.locator(".portal-sidebar")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Quick access" });
  await expect(nav.getByRole("link")).toHaveText(["Home", "Stock", "POS", "Payments", "Water"]);
  await expect(nav.getByRole("link", { name: "Payments", exact: true })).toHaveAttribute("href", "/admin/payments");
  await expect(nav.getByRole("link", { name: "POS", exact: true })).toHaveAttribute("href", "/admin/store-mode");
  await expect(nav.getByText("Buy", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Profile settings for Admin User" })).toHaveAttribute("href", "/admin/profile");
  await page.getByText("View chart data", { exact: true }).click();
  await expect(page.locator(".reebs-dashboard-chart-data dd")).toHaveCount(8);
  const healthToggle = page.locator(".reebs-dashboard-service-details > summary");
  await healthToggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".reebs-dashboard-service-details")).toHaveAttribute("open", "");
  await expect(page.getByText("REEBS API", { exact: true })).toBeVisible();
  await expect(page.locator(".reebs-dashboard-health")).toHaveCSS("box-shadow", "none");
  await expect(page.locator(".reebs-dashboard-health")).toHaveCSS("border-left-width", "0px");
  await injectAxe(page);
  await checkA11y(page, ".reebs-dashboard-page", { detailedReport: true, detailedReportOptions: { html: true } });
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
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back, Admin" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Core collections" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Quick access" });
    await expect(nav).toBeVisible();
    const positions = await nav.locator("a").evaluateAll((links) => links.map((link) => {
      const rect = link.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        unobstructed: link.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
    }));
    expect(positions[2].height).toBeGreaterThan(positions[1].height);
    const navBox = await nav.boundingBox();
    expect(Math.abs(positions[2].x + positions[2].width / 2 - (navBox.x + navBox.width / 2))).toBeLessThanOrEqual(1);
    for (const item of positions) { expect(item.height).toBeGreaterThanOrEqual(44); expect(item.width).toBeGreaterThanOrEqual(44); expect(item.unobstructed).toBe(true); }
    if (width <= 1024) expect(positions[0].y).toBeGreaterThan((width < 768 ? 844 : 900) - 110);
    else expect(positions[0].y).toBeLessThan(150);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    if (process.env.CAPTURE_DASHBOARD === "1" && [390, 768].includes(width)) {
      const screen = width === 390 ? "mobile" : "tablet";
      await page.screenshot({ path: `/tmp/reebs-dashboard-faako-${screen}.png`, fullPage: true });
      await page.locator(".reebs-dashboard-header").screenshot({ path: `/tmp/reebs-dashboard-faako-${screen}-header.png` });
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
    if (width <= 860) {
      // Read both boxes in the same browser frame, after the loaded content and
      // fonts are ready. Separate round trips can straddle a layout shift.
      const headerLayout = await page.evaluate(() => {
        const copy = document.querySelector(".reebs-dashboard-header-copy");
        const actions = document.querySelector(".reebs-dashboard-header-actions");
        const text = copy?.lastElementChild;
        if (!copy || !actions || !text) return null;
        return {
          containerGap: actions.getBoundingClientRect().top - copy.getBoundingClientRect().bottom,
          textGap: actions.getBoundingClientRect().top - text.getBoundingClientRect().bottom,
          copyFlex: getComputedStyle(copy).flex,
          copyHeight: copy.getBoundingClientRect().height,
        };
      });
      expect(headerLayout).not.toBeNull();
      expect(headerLayout?.containerGap).toBeGreaterThanOrEqual(0);
      expect(headerLayout?.containerGap).toBeLessThanOrEqual(32);
      // A stretched flex child can have a small container gap but a large blank
      // area below its text. Check the visible content, not just its wrapper.
      expect(headerLayout?.textGap, JSON.stringify(headerLayout)).toBeLessThanOrEqual(32);
    }
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
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    const payload = ["authSession", "session"].includes(endpoint || "")
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
  await page.locator(".reebs-dashboard-service-details > summary").click();
  await expect(page.getByText("System operational")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Water Business" })).toHaveCount(0);
});
