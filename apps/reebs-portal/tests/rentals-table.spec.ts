import { expect, test } from "@playwright/test";

const user = { id: 1, organizationId: 1, fullName: "Admin User", role: "admin", email: "admin@reebs.test" };
const rentalItems = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, name: `Rental ${index + 1}`, sku: `REN-${index + 1}`, sourceCategoryCode: "RENTAL",
  quantity: index + 1, stock: index + 1, price: 100, rate: "per day", status: true, specificCategory: "Bouncers",
}));

async function installFixtures(page, role = "admin") {
  let items = [...rentalItems];
  const mutations: number[] = [];
  const authUser = { ...user, role };
  await page.addInitScript((value) => localStorage.setItem("reebs_auth_user", JSON.stringify(value)), authUser);
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    let payload: unknown = [];
    let status = 200;
    if (["authSession", "session"].includes(endpoint || "")) payload = authUser;
    if (endpoint === "inventory") {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        mutations.push(body.id);
        if (body.id === 2) { status = 409; payload = { error: "Item cannot be archived." }; }
        else { items = items.filter((item) => item.id !== body.id); payload = { id: body.id, isArchived: true }; }
      } else payload = items;
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
  });
  return mutations;
}

for (const width of [390, 1440]) {
  test(`rental catalogue sorts, selects and reports partial archive at ${width}px`, async ({ page }, testInfo) => {
    const mutations = await installFixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/rentals");
    const table = page.locator(".rentals-table");
    await expect(table.locator("tbody tr")).toHaveCount(10, { timeout: 30_000 });
    expect(await table.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(1220);
    if (width < 1220) {
      const viewport = page.getByRole("region", { name: "Rental catalogue table" });
      expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "Sort by Units", exact: true }).click();
    await expect(table.locator("tbody tr").first()).toContainText("REN-1");
    await page.getByRole("button", { name: "Sort by Units", exact: true }).click();
    await expect(table.locator("tbody tr").first()).toContainText("REN-12");
    await page.getByRole("button", { name: "Sort by Item", exact: true }).click();
    await page.getByRole("checkbox", { name: "Select Rental 1", exact: true }).focus();
    await page.keyboard.press("Space");
    const all = page.getByRole("checkbox", { name: "Select rental items on this page", exact: true });
    expect(await all.evaluate((element) => getComputedStyle(element).accentColor)).not.toBe("auto");
    await expect(all).toHaveAttribute("aria-checked", "mixed");
    expect(await all.evaluate((element: HTMLInputElement) => element.indeterminate)).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await all.check();
    await expect(page.getByText("10 selected", { exact: true })).toBeVisible();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Archive selected", exact: true }).click();
    await expect(page.getByText(/1 rental item archived/)).toBeVisible();
    expect(mutations).toEqual([1, 2]);
    await expect(page.getByRole("checkbox", { name: "Select Rental 1", exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Select Rental 2", exact: true })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`rentals-table-${width}.png`), fullPage: true });
  });
}

test("non-admin staff do not receive rental archive selection controls", async ({ page }) => {
  await installFixtures(page, "staff");
  await page.goto("/admin/rentals");
  await expect(page.locator(".rentals-table tbody tr")).toHaveCount(10, { timeout: 30_000 });
  await expect(page.locator('.rentals-table input[type="checkbox"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive selected" })).toHaveCount(0);
});
