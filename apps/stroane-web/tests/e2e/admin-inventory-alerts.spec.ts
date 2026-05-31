import { expect, test, type Page } from "@playwright/test";

const SESSION_KEY = "stroane_admin_session_v1";
const ADMIN_SESSION = {
  token: "test-admin-token",
  username: "admin",
  role: "ADMIN",
};

const inventory = [
  {
    id: "inventory-low",
    productSlug: "digital-probe-thermometer",
    sku: "ST-PROBE-01",
    quantityOnHand: 4,
    reservedQuantity: 1,
    availableQuantity: 3,
    reorderThreshold: 4,
    lowStockThreshold: 3,
    stockStatus: "low_stock",
    computedStockStatus: "low_stock",
    inventoryTrackingEnabled: true,
    isLowStock: true,
    needsReorder: true,
    product: { id: "product-low", slug: "digital-probe-thermometer", name: "Digital Probe Thermometer" },
    updatedAt: "2026-05-31T10:00:00.000Z",
  },
  {
    id: "inventory-out",
    productSlug: "fridge-dial-thermometer",
    sku: "ST-FRIDGE-01",
    quantityOnHand: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    reorderThreshold: 3,
    lowStockThreshold: 2,
    stockStatus: "out_of_stock",
    computedStockStatus: "out_of_stock",
    inventoryTrackingEnabled: true,
    isLowStock: true,
    needsReorder: true,
    product: { id: "product-out", slug: "fridge-dial-thermometer", name: "Fridge Dial Thermometer" },
    updatedAt: "2026-05-31T09:00:00.000Z",
  },
];

const json = (body: object, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const useAdminSession = async (page: Page) => {
  await page.addInitScript(
    ({ key, value }) => window.sessionStorage.setItem(key, value),
    { key: SESSION_KEY, value: JSON.stringify(ADMIN_SESSION) }
  );
};

const mockInventoryApi = async (page: Page) => {
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === "GET" && pathname === "/api/admin/inventory") {
      return route.fulfill(json({ ok: true, inventory }));
    }
    if (request.method() === "GET" && pathname === "/api/admin/suppliers") {
      return route.fulfill(json({ ok: true, suppliers: [] }));
    }
    if (request.method() === "GET" && pathname === "/api/admin/inventory/movements") {
      return route.fulfill(json({ ok: true, movements: [] }));
    }
    if (request.method() === "GET" && pathname === "/api/admin/inventory/alerts") {
      return route.fulfill(
        json({
          ok: true,
          summary: {
            active: [],
            recentDispatches: [],
            counts: { lowStock: 1, outOfStock: 1, total: 2 },
          },
        })
      );
    }
    if (request.method() === "POST" && pathname === "/api/admin/inventory/alerts/check") {
      return route.fulfill(
        json({ ok: true, result: { checked: 2, detected: 2, restocked: 0, dispatched: 2 } })
      );
    }
    return route.fulfill(json({ error: "Unhandled mock admin route." }, 404));
  });
};

test("inventory admin route remains protected", async ({ page }) => {
  await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login$/);
});

test("inventory dashboard shows owner alert summary and restock recommendations", async ({ page }) => {
  await useAdminSession(page);
  await mockInventoryApi(page);
  await page.goto("/admin/inventory");

  await expect(page.getByText("2 product alert(s) need attention.")).toBeVisible();
  await expect(page.getByText("Reorder recommended")).toBeVisible();
  await expect(page.getByText("Restock required")).toBeVisible();

  await page.getByRole("button", { name: "Check alerts" }).click();
  await expect(page.getByText("Inventory alert check completed: 2 active warning(s), 0 recovery update(s).")).toBeVisible();
});

test("inventory alert controls remain usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useAdminSession(page);
  await mockInventoryApi(page);
  await page.goto("/admin/inventory");

  await expect(page.getByRole("button", { name: "Check alerts" })).toBeVisible();
  await expect(page.getByText("2 product alert(s) need attention.")).toBeVisible();
});
