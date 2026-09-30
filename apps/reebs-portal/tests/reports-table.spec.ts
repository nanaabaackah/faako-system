import { expect, test } from "@playwright/test";

const user = { id: 1, organizationId: 1, fullName: "Admin User", role: "admin", email: "admin@example.test" };
const series = Array.from({ length: 12 }, (_, index) => ({
  date: `2026-09-${String(index + 1).padStart(2, "0")}`,
  total: index + 1, incidents: 0, failures: 0,
}));
const recentEvents = series.map((item, index) => ({
  id: index + 1, createdAt: `${item.date}T12:00:00Z`, summary: `Fixture event ${index + 1}`,
  action: "FIXTURE_ACTION", targetType: "Fixture", targetId: index + 1,
  severity: "info", category: "admin",
}));

test("Faako report tables sort the full snapshot before pagination and retain protected history", async ({ page }, testInfo) => {
  await page.addInitScript((value) => localStorage.setItem("reebs_auth_user", JSON.stringify(value)), user);
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    const payload = ["authSession", "session"].includes(endpoint || "") ? user
      : endpoint === "reports" ? { series, recentEvents, generatedAt: "2026-09-26T00:00:00Z", kpis: [] } : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/reports");
  const trend = page.locator(".ui-data-table").first();
  const events = page.locator(".ui-data-table").last();
  await expect(trend.locator("tbody tr")).toHaveCount(10, { timeout: 30_000 });
  await trend.getByRole("button", { name: "Next", exact: true }).first().click();
  await expect(trend.locator("tbody tr")).toHaveCount(2);
  await trend.getByRole("button", { name: /^Sort by Events/ }).click();
  await trend.getByRole("button", { name: /^Sort by Events/ }).click();
  await expect(trend.locator("tbody tr")).toHaveCount(10);
  await expect(trend.locator("tbody tr").first()).toContainText("2026-09-12");
  await expect(events.locator("tbody tr")).toHaveCount(10);
  await events.getByRole("button", { name: /^Sort by Created/ }).click();
  await events.getByRole("button", { name: /^Sort by Created/ }).click();
  await expect(events.locator("tbody tr").first()).toContainText("Fixture event 12");
  await events.getByRole("button", { name: "Next", exact: true }).first().click();
  await expect(events.locator("tbody tr")).toHaveCount(2);
  // Paging one snapshot must not move the other table.
  await expect(trend.locator("tbody tr")).toHaveCount(10);
  await expect(page.locator('.ui-data-table input[type="checkbox"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive selected" })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  for (const controls of await page.locator(".table-pagination-controls").all()) {
    expect(await controls.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  // Keyboard focus can reach data columns inside the horizontal table region.
  await trend.getByRole("button", { name: /^Sort by Warnings/ }).focus();
  await page.keyboard.press("Enter");
  await expect(trend.locator('th[aria-sort="ascending"]')).toHaveText(/Warnings/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await trend.screenshot({ path: testInfo.outputPath("report-trend-mobile.png") });
  // A new reporting window resets both snapshots, not the business data.
  await page.getByRole("button", { name: "Reporting range", exact: true }).click();
  const picker = page.getByRole("listbox", { name: "Reporting range", exact: true });
  await expect(picker).toBeInViewport();
  const pickerBounds = await picker.boundingBox();
  expect(pickerBounds?.y).toBeGreaterThanOrEqual(0);
  expect((pickerBounds?.y || 0) + (pickerBounds?.height || 0)).toBeLessThanOrEqual(844);
  await page.getByRole("option", { name: "Last 30 days", exact: true }).click();
  await expect(events.locator("tbody tr")).toHaveCount(10);
  await expect(events.getByText("Showing 1-10 of 12", { exact: true }).first()).toBeVisible();
});
