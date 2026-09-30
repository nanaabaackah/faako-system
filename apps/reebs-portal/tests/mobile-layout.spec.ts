import { expect, test, type Locator, type Page } from "@playwright/test";

const user = { id: 1, organizationId: 1, fullName: "Admin User", role: "admin", email: "admin@example.test" };
const customer = {
  id: 41, name: "Abundant Grace Event Planning and Hospitality", reference: "CUS-000041",
  email: "contact@example.test", phone: "+233244123456", customerType: "organization",
  orders: 1, bookings: 1, total_spent: 25000, total_rented: 90000,
};
const payment = {
  id: 12, paymentReference: "REEBS-PAY-000012", amountCents: 12500, currency: "GHS",
  method: "Mobile Money", provider: "MTN", source: "MANUAL", status: "successful",
  paidAt: "2026-09-03T10:00:00Z", customer,
  relatedRecord: { type: "ORDER", id: 9, reference: "ORD-20260929-000091" }, businessUnit: "REEBS_CORE",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => localStorage.setItem("reebs_auth_user", JSON.stringify(value)), user);
  // Every API (including mutations) is intercepted; this suite cannot write live data.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      const endpoint = url.pathname.split("/").pop();
      const body = ["session", "authSession"].includes(endpoint || "") ? user
        : endpoint === "customers" ? { items: [customer], pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 }, permissions: { canViewFinancials: true }, scope: "core" }
          : endpoint === "payments" ? { items: [payment], pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 }, businessUnit: "REEBS_CORE" }
            : [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    return route.continue();
  });
});

async function open(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  // Vite's first lazy admin-module transform can exceed 30s on constrained
  // developer machines; keep the actual geometry assertions strict.
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 90_000 });
}

async function contained(controls: Locator) {
  const outside = await controls.evaluateAll((nodes) => nodes.filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
  }).map((node) => node.getAttribute("aria-label") || node.textContent?.trim()));
  expect(outside, "Controls must fit, not just be hidden by page overflow").toEqual([]);
}

async function separated(first: Locator, second: Locator) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (a && b) expect(Math.min(a.x + a.width, b.x + b.width) <= Math.max(a.x, b.x) + 1
    || Math.min(a.y + a.height, b.y + b.height) <= Math.max(a.y, b.y) + 1).toBe(true);
}

for (const width of [320, 390, 768, 1280]) {
  test(`headers, actions, calendar and forms reflow at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["inventory", "documents", "schedule", "settings", "crm", "payments"]) {
      await test.step(route, async () => {
        await open(page, `/admin/${route}`);
        const header = page.locator(".admin-header").first();
        if (width <= 860) {
          const copy = await header.locator(":scope > :first-child").boundingBox();
          const title = await header.locator("h1").boundingBox();
          expect(copy!.height - title!.height, "No desktop flex-basis used as mobile header height").toBeLessThan(200);
        }
        await contained(header.locator("button, summary"));
        if (route === "inventory") {
          const menu = page.getByLabel("Inventory admin menu", { exact: true }).first();
          await menu.click();
          await contained(page.locator(".module-topbar-menu__panel"));
          await menu.click();
        }
        if (route === "documents") await contained(page.locator(".documents-form input, .documents-form button, .documents-toolbar button"));
        if (route === "schedule") {
          await expect(page.locator(".calendar-day")).not.toHaveCount(0);
          await contained(page.locator(".calendar-day, .calendar-nav, .calendar-month-toggle"));
          await page.getByRole("button", { name: "Next month", exact: true }).click();
          await contained(page.locator(".calendar-day"));
        }
        if (route === "settings") {
          await separated(page.getByRole("button", { name: "Save preferences", exact: true }), page.locator(".settings-grid--preferences .ui-dropdown-field__trigger").first());
          await contained(page.locator(".settings-grid--preferences button"));
        }
        if (route === "crm" && width < 768) {
          await separated(page.getByRole("button", { name: `Open ${customer.name}`, exact: true }).first(), page.getByRole("button", { name: `Archive ${customer.name}`, exact: true }).first());
          const refresh = header.getByRole("button", { name: "Refresh", exact: true });
          expect((await refresh.boundingBox())!.width).toBeGreaterThanOrEqual(44);
          await refresh.focus();
          await expect(refresh).toBeFocused();
          await page.keyboard.press("Enter");
        }
        if (route === "crm" && width >= 768) {
          const archive = page.getByRole("button", { name: `Archive ${customer.name}`, exact: true }).first();
          await archive.scrollIntoViewIfNeeded();
          await contained(archive);
          expect((await archive.boundingBox())!.width).toBeGreaterThanOrEqual(44);
        }
        if (route === "payments") await contained(page.locator(".table-pagination button"));
        if (route === "payments" && width <= 620) {
          await expect(page.getByText(payment.paymentReference)).toBeVisible();
          const content = page.locator('.payments-results td[data-label="Payment"] strong');
          expect(await content.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("normal");
          const customerCell = page.locator('.payments-results td[data-label="Customer"]');
          expect(await customerCell.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("normal");
          expect(await customerCell.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
          await contained(page.locator(".payments-results tbody td, .table-pagination button"));
          await page.getByRole("button", { name: "View", exact: true }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await contained(page.getByRole("dialog").locator("button, a"));
          await page.keyboard.press("Escape");
        }
        await page.screenshot({ path: testInfo.outputPath(`${route}-${width}.png`) });
      });
    }
  });
}
