import { expect, test } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

for (const [width, theme] of [[320, "dark"], [1440, "light"]] as const) {
  test(`customer editing and Water credit use Faako dialogs at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const user = { id: 1, fullName: "Water Admin", role: "admin", email: "admin@example.test" };
    let customer = { id: 2, name: "Credit Customer", phone: "0241234567", email: "" };
    const sale = { id: 5, customerId: 2, customerName: customer.name, productKey: "gwater-15pk", productName: "GWater",
      quantity: 2, unitPrice: 3000, totalAmount: 6000, balanceDueCents: 6000, collectedCents: 0, amountPaidCents: 0,
      paymentStatus: "unpaid", paymentMethod: "credit", applicationCount: 0, date: "2026-10-01" };
    const dashboard = { product: { key: "gwater-15pk", name: "GWater", pricing: { retailPrice: 3000, companyPrice: 3000, bulkPrice: 3000, bulkThreshold: 10 } },
      permissions: { canRecordSales: true, canManagePricing: true, canViewCost: true, canViewFinance: true },
      sales: [sale], restocks: [], adjustments: [], expenses: [], collections: [], summary: {} };
    const writes: Record<string, unknown>[] = [];
    await page.addInitScript((value) => localStorage.setItem("reebs_auth_user", JSON.stringify(value)), user);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (/auth\/session|authSession/i.test(url.pathname)) return route.fulfill({ json: user });
      if (url.pathname.endsWith("/customers")) {
        if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON(); writes.push(body); customer = { ...customer, ...body };
          return route.fulfill({ json: customer });
        }
        return route.fulfill({ json: url.searchParams.has("id") ? { scope: "water", customer, permissions: { canEditCustomer: true },
          waterTotals: { sales: 1, revenue: 6000, outstandingCents: 6000, legacyPaidCents: 0 }, waterCredit: { availableCents: 2500 }, waterSales: [sale] } : [customer] });
      }
      if (url.pathname.endsWith("/water")) {
        if (route.request().method() === "POST") writes.push(route.request().postDataJSON());
        return route.fulfill({ json: dashboard });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/customers");
    const open = page.getByRole("button", { name: "Open customer Credit Customer" });
    await open.click();
    const drawer = page.getByRole("dialog", { name: "Credit Customer", exact: true });
    await expect(drawer.getByText("Available Water credit", { exact: true })).toBeVisible();
    await drawer.getByLabel("Phone", { exact: true }).fill("0247654321");
    await drawer.getByRole("button", { name: "Save customer", exact: true }).click();
    await expect(drawer.getByRole("status")).toHaveText("Customer details saved.");
    expect(writes[0]).toMatchObject({ id: 2, phone: "0247654321" });
    await injectAxe(page); await checkA11y(page, ".water-customer-drawer", { detailedReport: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`customer-${width}-${theme}.png`), fullPage: true });
    await drawer.getByRole("button", { name: "Close customer" }).click();
    await expect(open).toBeFocused();
    await page.goto("/orders");
    await expect(page.getByRole("region", { name: "Water order summary" })).toContainText("60.00");
    await page.getByRole("button", { name: "Record collection for sale 5" }).click();
    const dialog = page.getByRole("dialog", { name: "Record collection · Sale #5" });
    await dialog.getByLabel("Amount received (GHS)", { exact: true }).fill("80");
    const submit = dialog.getByRole("button", { name: "Record collection", exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "Keep the excess as customer credit for future Water orders" }).check();
    await expect(dialog).toContainText("20.00");
    await injectAxe(page); await checkA11y(page, '[aria-labelledby="water-collection-title"]', { detailedReport: true });
    await page.screenshot({ path: testInfo.outputPath(`credit-${width}-${theme}.png`), fullPage: true });
    await submit.click();
    await expect(dialog).not.toBeVisible();
    expect(writes[1]).toMatchObject({ action: "record_collection", retainCustomerCredit: true, amount: "80", saleId: 5 });
    await page.getByRole("button", { name: "Record collection for sale 5" }).click();
    await dialog.getByRole("button", { name: "Apply customer credit", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(writes[2]).toMatchObject({ action: "apply_customer_credit", amount: "25.00", saleId: 5 });
  });
}
