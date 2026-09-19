import { expect, test } from "@playwright/test";

const adminUser = {
  id: 1,
  organizationId: 1,
  fullName: "Admin User",
  role: "admin",
  email: "admin@reebs.test",
};

const documents = Array.from({ length: 11 }, (_, index) => ({
  id: index + 1,
  sourceType: "manual",
  sourceId: null,
  customerId: 8,
  documentType: "invoice",
  title: `Invoice ${index + 1}`,
  invoiceNumber: `INV-2026-${String(index + 1).padStart(6, "0")}`,
  issueDate: "2026-09-04",
  dueDate: "2026-09-11",
  paymentStatus: index === 0 ? "partially_paid" : "unpaid",
  businessUnit: "REEBS_CORE",
  currency: "GHS",
  paymentStateVersion: 1,
  issuedAt: "2026-09-04T08:00:00.000Z",
  customerName: `Customer ${index + 1}`,
  customerEmail: `customer${index + 1}@example.com`,
  lineItems: [{ id: "line-1", rowType: "item", name: "Event package", quantity: 1, unitPrice: 100, total: 100 }],
  expenses: [],
  additionalItems: [],
  financialSnapshot: { version: 1, subtotalCents: 10000, additionalCents: 0, taxCents: 0, discountCents: 0, totalCents: 10000, taxRate: 0 },
  paymentSummary: { amountPaidCents: index === 0 ? 2500 : 0, balanceDueCents: index === 0 ? 7500 : 10000, totalCents: 10000, paymentStatus: index === 0 ? "partially_paid" : "unpaid" },
  grandTotal: 100,
  createdAt: "2026-09-04T08:00:00.000Z",
  updatedAt: "2026-09-04T08:00:00.000Z",
}));

const paidOrder = {
  id: 91,
  orderNumber: "ORD-PAYMENT-CHECK",
  customerName: "Payment Check Customer",
  total: 100,
  totalCents: 10000,
  amountPaidCents: 4200,
  balanceDueCents: 5800,
  paymentStatus: "partially_paid",
  orderDate: "2026-09-05T08:00:00.000Z",
  lastModifiedAt: "2026-09-05T08:00:00.000Z",
};

const installFixtures = async (page) => {
  await page.addInitScript((user) => localStorage.setItem("reebs_auth_user", JSON.stringify(user)), adminUser);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split("/").pop();
    let payload: unknown = [];
    if (endpoint === "authSession") payload = adminUser;
    if (endpoint === "invoice-documents") {
      payload = url.searchParams.has("id")
        ? { ...documents[Number(url.searchParams.get("id")) - 1], payments: [] }
        : documents;
    }
    if (endpoint === "orders") payload = [paidOrder];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
};

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`invoice register fits ${width}px and retains pagination`, async ({ page }) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/admin/invoicing", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Invoicing" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("INV-2026-000001").first()).toBeVisible();
    await expect(page.getByText("Page 1 of 2").first()).toBeVisible();
    await expect(page.getByText("Showing 1-10 of 12").first()).toBeVisible();
    await expect(page.getByText("Manual").first()).toBeVisible();
    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.html).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
  });
}

test("issued invoice is visibly immutable and payment-derived", async ({ page }) => {
  await installFixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/invoicing", { waitUntil: "domcontentloaded" });
  await page.getByText("INV-2026-000001").first().click();
  await expect(page.getByText("Issued document")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save document" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Document issued" })).toBeDisabled();
  await expect(page.getByText("GH₵25.00").last()).toBeVisible();
  await expect(page.getByText("GH₵75.00").last()).toBeVisible();
});

test("order-backed rows show source paid and balance amounts", async ({ page }) => {
  await installFixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/invoicing", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Search invoice, receipt, customer or source").fill("ORD-PAYMENT-CHECK");
  const row = page.locator(".invoice-hub-table-row").filter({ hasText: "ORD-PAYMENT-CHECK" });
  await expect(row).toBeVisible();
  await expect(row.getByText("GH₵42.00")).toBeVisible();
  await expect(row.getByText("GH₵58.00")).toBeVisible();
});
