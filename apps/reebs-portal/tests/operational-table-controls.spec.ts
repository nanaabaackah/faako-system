import { expect, test } from "@playwright/test";

const user = { id: 1, organizationId: 1, fullName: "Admin User", role: "admin", email: "admin@reebs.test" };
const rows = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, amount: (index + 1) * 100, date: "2026-09-26", category: "Operational", description: `Expense ${index + 1}`,
  productId: index + 1, productName: `Asset ${index + 1}`, issue: "Inspection", status: "open", cost: index + 1, createdAt: "2026-09-26",
  code: `OFFER-${index + 1}`, type: "FIXED", value: index + 1, scope: "retail", minOrderValue: index + 1, usageCount: index + 1, isActive: true,
  fullName: `User ${index + 1}`, email: `user${index + 1}@example.test`, role: "staff",
  name: `Vendor ${index + 1}`, contactName: `Contact ${index + 1}`, products: index + 1, leadTimeDays: index + 1,
}));

for (const [route, tableClass, sortLabel, expectedFirst] of [
  ["/admin/expenses", ".expenses-ledger-table", "Amount", "Expense 12"],
  ["/admin/maintenance", ".maintenance-page table", "Cost", "Asset 12"],
  ["/admin/marketing", ".marketing-table", "Usage", "OFFER-12"],
  ["/admin/roles", ".roles-table", "User", "User 12"],
  ["/admin/directory", ".customers-table--users", "Name", "User 12"],
  ["/admin/directory?tab=vendors", ".customers-table--vendors", "Products", "Vendor 12"],
]) {
  test(`${route} keeps sorting, pagination and protected actions`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("reebs_auth_user", JSON.stringify(value)), user);
    await page.route((url) => url.pathname.startsWith("/api/"), (request) => {
      const endpoint = new URL(request.request().url()).pathname.split("/").pop();
      const payload = ["authSession", "session"].includes(endpoint || "") ? user
        : ["expenses", "maintenance", "marketing", "users", "vendors"].includes(endpoint || "") ? rows : [];
      return request.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    const table = page.locator(tableClass);
    await expect(table.locator("tbody tr")).toHaveCount(10, { timeout: 30_000 });
    const sort = table.getByRole("button", { name: `Sort by ${sortLabel}`, exact: true });
    await sort.click();
    await sort.click();
    await expect(table.locator("tbody tr").first()).toContainText(expectedFirst);
    await expect(table.locator('th[aria-sort="descending"]')).toHaveText(sortLabel);
    await page.getByRole("button", { name: "Next", exact: true }).last().click();
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(table.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archive selected", exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
