import { expect, test } from "@playwright/test";

const admin = { id: 1, userId: 1, organizationId: 1, fullName: "Admin User", email: "admin@example.com", roleName: "Admin", role: { name: "Admin", permissions: null } };
const payment = {
  id: 7,
  customerName: "Acme Studio",
  customerEmail: "client@acme.test",
  description: "Website implementation deposit",
  expectedMinor: 500000,
  receivedMinor: 0,
  outstandingMinor: 500000,
  currency: "GHS",
  status: "PENDING",
  dueAt: "2099-12-31",
  attempts: [{ id: 9, amountMinor: 500000, currency: "GHS", providerReference: "DEV-PAY-test-reference", status: "PENDING", checkoutUrl: "https://checkout.paystack.com/test", createdAt: "2026-10-23T10:00:00.000Z", linkDeliveryStatus: "NOT_SENT" }],
  receipts: [],
};

const installApi = async (page) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/auth/session") return fulfill({ user: admin, csrfToken: "csrf-token" });
    if (path === "/api/payments/requests") return fulfill({ standalonePayments: [payment], invoicePayments: [] });
    if (path === "/api/payments/reconciliation-exceptions") return fulfill({ exceptions: [] });
    if (path === "/api/payments/intents/9/send") return fulfill({ sent: true, sentTo: payment.customerEmail });
    return fulfill({ notifications: [], unreadCount: 0 });
  });
};

test("administrator reviews and sends a standalone Paystack request", async ({ page }) => {
  await installApi(page);
  await page.goto("/payments", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
  await expect(page.getByText("Acme Studio").first()).toBeVisible();
  await expect(page.locator('input[value="https://checkout.paystack.com/test"]')).toBeVisible();
  await page.getByRole("button", { name: "Send link" }).click();
  await expect(page.getByText("Payment link sent to client@acme.test.")).toBeVisible();
  await expect(page.getByText("No reconciliation exceptions.")).toBeVisible();
});

test("Payments workspace remains within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto("/payments", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test("public payment return never claims success before backend confirmation", async ({ page }) => {
  await page.route("**/api/public/payments/status/**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "PENDING", amount: "50.00", currency: "GHS", receiptAvailable: false }) }));
  await page.goto(`/payment/status?token=${"a".repeat(43)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Payment is still processing" })).toBeVisible();
  await expect(page.getByText("Payment confirmed")).toHaveCount(0);
});
