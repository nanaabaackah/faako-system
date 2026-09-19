import { expect, test, type Page } from "@playwright/test";

const adminUser = {
  id: 1,
  organizationId: 1,
  firstName: "Inventory",
  lastName: "Admin",
  fullName: "Inventory Admin",
  role: "admin",
  email: "inventory@reebs.test",
};

const inventory = [
  {
    id: 21,
    name: "Test Speaker",
    sku: "SHP-SPK-21",
    sourceCategoryCode: "SHOP",
    specificCategory: "Audio",
    price: 350,
    quantity: 2,
    stock: 2,
    reorderLevel: 3,
    reorderQuantity: 5,
    availableQuantity: 2,
    reservedQuantity: 0,
    inUseQuantity: 0,
    stockStatus: "low_stock",
    availabilityMode: "ON_HAND",
    status: true,
    variants: [],
  },
  {
    id: 22,
    name: "Test Bounce House",
    sku: "REN-BNC-22",
    sourceCategoryCode: "RENTAL",
    specificCategory: "Bouncers",
    price: 900,
    quantity: 5,
    stock: 5,
    reorderLevel: 2,
    availableQuantity: null,
    reservedQuantity: 2,
    inUseQuantity: 1,
    stockStatus: "available",
    availabilityMode: "DATE_BASED",
    status: true,
    variants: [],
  },
];

const mockInventoryApi = async (page: Page) => {
  await page.addInitScript((user) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, adminUser);

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split("/").pop();
    let body: unknown = [];

    if (endpoint === "authSession" || endpoint === "login") body = adminUser;
    if (endpoint === "inventory") {
      body = url.searchParams.has("view") ? [] : inventory;
    }
    if (endpoint === "stock") {
      body = {
        productId: 21,
        newStock: 3,
        lastUpdatedAt: "2026-09-01T08:00:00.000Z",
        lastUpdatedByName: "Inventory Admin",
      };
    }
    if (endpoint === "stockActivity") {
      body = url.searchParams.get("view") === "movements"
        ? {
            items: [{
              id: 1,
              productId: 21,
              type: "StockIn",
              quantity: 2,
              previousStock: 0,
              resultingStock: 2,
              performedByName: "Inventory Admin",
              date: "2026-09-01T08:00:00.000Z",
            }],
            pagination: { page: 1, pageSize: 20, total: 1, pageCount: 1 },
          }
        : [];
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
};

test.describe("Inventory operations", () => {
  test.beforeEach(async ({ page }) => {
    await mockInventoryApi(page);
  });

  test("fits supported mobile and desktop widths without horizontal page overflow", async ({ page }) => {
    test.setTimeout(180_000);
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: /stock management/i })).toBeVisible({ timeout: 30_000 });
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      expect(dimensions.page, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  });

  test("shows operational stock states and keeps Water financial data out of Core Inventory", async ({ page }) => {
    await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Test Speaker").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Low stock").first()).toBeVisible();
    await expect(page.getByText("Test Bounce House").first()).toBeVisible();
    await expect(page.getByText(/Water revenue|Water profit|Water stock value/i)).toHaveCount(0);
  });

  test("opens item detail and lazily loads movement history", async ({ page }) => {
    await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
    await page.getByText("Test Speaker").first().click();
    await expect(page.getByRole("heading", { name: "Test Speaker" })).toBeVisible();
    const stockInput = page.getByLabel(/Stock on hand/i);
    await expect(stockInput).toBeDisabled();
    await page.getByRole("button", { name: "Load history" }).click();
    await expect(page.getByText("Stock added")).toBeVisible();
    await expect(page.getByText("Balance 2")).toBeVisible();
  });
});
