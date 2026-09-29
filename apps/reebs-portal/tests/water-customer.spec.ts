import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`Water search persists a customer and exposes retryable errors at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    const user = { id: 1, fullName: "Water Staff", role: "water", email: "water@example.test" };
    await page.addInitScript((value) => localStorage.setItem("reebs_auth_user", JSON.stringify(value)), user);
    let customers = [];
    let fail = true;
    const writes = [];
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (/auth\/session|authSession/i.test(url.pathname)) return route.fulfill({ json: user });
      if (url.pathname.endsWith("/customers")) return route.fulfill({ json: customers });
      if (url.pathname.endsWith("/water")) {
        if (route.request().method() === "POST") {
          const payload = route.request().postDataJSON();
          writes.push(payload);
          if (fail) return route.fulfill({ status: 503, json: { error: "Customer service temporarily unavailable." } });
          customers = [{ id: 42, name: payload.name, phone: null }];
          return route.fulfill({ status: 201, json: { created: true, customer: customers[0], businessUnit: "WATER" } });
        }
        return route.fulfill({ json: {
          scope: "water", businessUnit: "WATER",
          permissions: { canViewCost: false, canViewFinance: false, canManagePricing: false, canOverridePrice: false },
          product: { key: "gwater-15pk", name: "15pk Gwater", pricing: {
            currency: "GHS", retailSingle: 2700, retailBulk: 2600, company: 2500, bulkThreshold: 10, discountLimitBps: 9999,
          } },
          restocks: [], sales: [{
            id: 9, quantity: 1, totalAmount: 2700, unitPrice: 2700, customerName: "Original Customer",
            saleChannel: "retail", paymentMethod: "cash", paymentStatus: "paid",
            date: "2026-09-28T08:00:00Z", createdAt: "2026-09-28T08:00:00Z",
          }], adjustments: [], expenses: [], summary: {},
        } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
    const search = page.getByRole("searchbox", { name: /Search or add customer/i });
    await expect(search).toBeVisible({ timeout: 90000 });
    await search.fill("New Water Customer");
    await page.getByRole("button", { name: 'Create "New Water Customer"' }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Customer service temporarily unavailable." })).toBeVisible();
    await expect(search).toHaveValue("New Water Customer");
    fail = false;
    await search.focus();
    await search.press("Enter");
    await expect(page.getByText("Water customer created.", { exact: true })).toBeVisible();
    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ action: "create_customer", name: "New Water Customer" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await search.fill("New Water Customer");
    await expect(page.getByRole("button", { name: "New Water Customer #42" })).toBeVisible();
    await search.press("Escape");
    await page.getByRole("row", { name: "Edit water order 9" }).click();
    const dialog = page.getByRole("dialog", { name: "Order #9" });
    const editSearch = dialog.getByRole("searchbox", { name: "Search or add customer" });
    await editSearch.fill("Customer From Editor");
    await dialog.getByRole("button", { name: 'Create "Customer From Editor"' }).click();
    await expect(editSearch).toHaveValue("Customer From Editor");
    await expect.poll(() => writes.length).toBe(3);
    await expect(dialog.getByRole("button", { name: 'Create "Customer From Editor"' })).toHaveCount(0);
    expect(writes.every((payload) => payload.action === "create_customer")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
