import { expect, test, type Page } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";

const adminUser = {
  id: 1,
  organizationId: 1,
  firstName: "Admin",
  lastName: "User",
  fullName: "Admin User",
  role: "admin",
  email: "admin@reebs.test",
};

const customer = {
  id: 41,
  organizationId: 1,
  reference: "CUS-000041",
  customerType: "individual",
  name: "Ama Mensah",
  email: "ama@example.com",
  phone: "+233 24 412 3456",
  locality: "Osu",
  region: "Greater Accra",
  ghanaPostGps: "GA-123-4567",
  orders: 1,
  bookings: 1,
  total_spent: 25000,
  total_rented: 90000,
  contact_requests: 0,
  open_contact_requests: 0,
  last_activity_at: "2026-09-01T09:00:00.000Z",
  createdAt: "2026-01-15T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
};

const customerDetail = {
  customer,
  scope: "core",
  totals: { orders: 1, bookings: 1, totalSpent: 25000, totalRented: 90000 },
  orders: [{
    id: 11,
    orderNumber: "REEBS-0011",
    status: "confirmed",
    orderDate: "2026-08-31T10:00:00.000Z",
    total_with_delivery: 25000,
  }],
  bookings: [{
    id: 12,
    reference: "BKG-0012",
    status: "confirmed",
    eventDate: "2026-09-10T10:00:00.000Z",
    totalAmount: 90000,
  }],
  payments: [{
    id: 15,
    amountCents: 25000,
    method: "mobile_money",
    status: "succeeded",
    paidAt: "2026-08-31T10:05:00.000Z",
    transactionReference: "MOMO-0015",
  }],
  invoices: [{
    id: 16,
    sourceType: "orders",
    sourceId: 11,
    documentType: "invoice",
    invoiceNumber: "INV-0016",
    issueDate: "2026-08-31",
    paymentStatus: "paid",
  }],
  contactRequests: [],
  activities: [],
  permissions: { canViewFinancials: true, canViewInvoices: true },
};

const installCustomerFixtures = async (page: Page, user = adminUser, mutations: unknown[] = []) => {
  await page.addInitScript((authUser) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(authUser));
  }, user);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.split("/").pop();
    let body: unknown = [];

    if (endpoint === "authSession") body = user;
    if (endpoint === "customers") {
      if (request.method() === "GET" && url.searchParams.has("id")) {
        body = customerDetail;
      } else if (request.method() === "GET") {
        body = {
          items: [customer],
          pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
          scope: "core",
          permissions: { canViewFinancials: true },
        };
      } else {
        mutations.push(request.postDataJSON());
        body = { ...customer, id: 42, reference: "CUS-000042", name: "Acme Events" };
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
};

test.describe("Customer workspace", () => {
  test("fits supported staff viewports without page-level horizontal overflow", async ({ page }) => {
    test.setTimeout(180_000);
    await installCustomerFixtures(page);
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("/admin/crm", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "CRM" })).toBeVisible({ timeout: 30_000 });
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      expect(dimensions.page, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  });

  test("creates a Ghana-ready organization customer from the mobile dialog", async ({ page }) => {
    const mutations: unknown[] = [];
    await installCustomerFixtures(page, adminUser, mutations);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/crm");
    await page.getByRole("button", { name: "Add customer" }).click();
    const dialog = page.getByRole("dialog", { name: "New customer" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: "Organization" }).check();
    await dialog.getByLabel("Organization name").fill("Acme Events");
    await dialog.getByLabel("Primary contact person").fill("Kojo Asare");
    await dialog.getByLabel("Primary phone").fill("024 412 3456");
    await dialog.getByLabel("Town or area").fill("Osu");
    await dialog.getByLabel("Region").selectOption("Greater Accra");
    await dialog.getByLabel("GhanaPost GPS").fill("GA-123-4567");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect.poll(() => mutations.length).toBe(1);
    expect(mutations[0]).toMatchObject({
      customerType: "organization",
      organizationName: "Acme Events",
      contactPersonName: "Kojo Asare",
      phone: "024 412 3456",
      ghanaPostGps: "GA-123-4567",
    });
    await expect(dialog).toHaveCount(0);
  });

  test("shows permission-gated Core payment and invoice history without Water finance", async ({ page }) => {
    await installCustomerFixtures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/crm");
    await page.getByRole("button", { name: "Open Ama Mensah" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Ama Mensah" });
    await expect(dialog.getByText("MOMO-0015")).toBeVisible();
    await expect(dialog.getByText("INV-0016")).toBeVisible();
    await expect(dialog.getByText(/Water revenue|Water balance|Water profit/i)).toHaveCount(0);
  });

  test("keeps the customer workspace keyboard-accessible and driver read-only", async ({ page }) => {
    const driver = { ...adminUser, id: 4, role: "driver", email: "driver@reebs.test" };
    await installCustomerFixtures(page, driver);
    await page.goto("/admin/crm");
    await expect(page.getByRole("heading", { level: 1, name: "CRM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add customer" })).toHaveCount(0);
    await page.getByRole("button", { name: "Open Ama Mensah" }).first().focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Ama Mensah" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Contact profile" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /archive/i })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("passes an automated accessibility scan for the customer workspace", async ({ page }) => {
    await installCustomerFixtures(page);
    await page.goto("/admin/crm");
    await expect(page.getByRole("heading", { level: 1, name: "CRM" })).toBeVisible();
    await injectAxe(page);
    await checkA11y(page, ".crm-page", {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });
});
