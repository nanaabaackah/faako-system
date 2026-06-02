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

const recentMovement = {
  id: "movement-1",
  inventoryItemId: "inventory-low",
  productSlug: "digital-probe-thermometer",
  movementType: "RESTOCK",
  quantityDelta: 4,
  quantityBefore: 0,
  quantityAfter: 4,
  createdAt: "2026-05-31T10:00:00.000Z",
};

const useAdminSession = async (page: Page) => {
  await page.addInitScript(
    ({ key, value }) => window.sessionStorage.setItem(key, value),
    { key: SESSION_KEY, value: JSON.stringify(ADMIN_SESSION) }
  );
};

const mockInventoryApi = async (
  page: Page,
  {
    inventoryDelayMs = 0,
    inventoryRows = inventory,
  }: { inventoryDelayMs?: number; inventoryRows?: Array<Record<string, unknown>> } = {}
) => {
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === "GET" && pathname === "/api/admin/inventory") {
      if (inventoryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, inventoryDelayMs));
      }
      return route.fulfill(json({ ok: true, inventory: inventoryRows }));
    }
    if (request.method() === "GET" && pathname === "/api/admin/suppliers") {
      return route.fulfill(json({ ok: true, suppliers: [] }));
    }
    if (request.method() === "GET" && pathname === "/api/admin/inventory/movements") {
      return route.fulfill(json({ ok: true, movements: [recentMovement] }));
    }
    if (request.method() === "POST" && pathname === "/api/admin/inventory/movements") {
      const payload = request.postDataJSON() as {
        inventoryItemId: string;
        movementType: string;
        quantityDelta: number;
      };
      const inventoryItem = inventoryRows.find((item) => item.id === payload.inventoryItemId);
      if (!inventoryItem) {
        return route.fulfill(json({ error: "Inventory item not found." }, 404));
      }
      const quantityOnHand = Number(inventoryItem.quantityOnHand ?? 0) + payload.quantityDelta;
      const reservedQuantity = Number(inventoryItem.reservedQuantity ?? 0);
      return route.fulfill(
        json({
          ok: true,
          inventoryItem: {
            ...inventoryItem,
            quantityOnHand,
            availableQuantity: quantityOnHand - reservedQuantity,
            updatedAt: "2026-06-02T12:00:00.000Z",
          },
          movement: {
            ...recentMovement,
            id: "movement-created",
            inventoryItemId: payload.inventoryItemId,
            movementType: payload.movementType,
            quantityDelta: payload.quantityDelta,
            quantityBefore: Number(inventoryItem.quantityOnHand ?? 0),
            quantityAfter: quantityOnHand,
            createdAt: "2026-06-02T12:00:00.000Z",
          },
        })
      );
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
    if (request.method() === "GET" && pathname === "/api/admin/products") {
      return route.fulfill(json({ ok: true, products: [], categories: [] }));
    }
    return route.fulfill(json({ error: "Unhandled mock admin route." }, 404));
  });
};

test("inventory admin route remains protected", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login$/, { timeout: 45_000 });
});

test("inventory dashboard shows owner alert summary and restock recommendations", async ({ page }) => {
  await useAdminSession(page);
  await mockInventoryApi(page);
  await page.goto("/admin/inventory");

  await expect(page.getByText("2 product alert(s) need attention.")).toBeVisible();
  await expect(page.getByRole("table").getByText("Reorder recommended")).toBeVisible();
  await expect(page.getByRole("table").getByText("Restock required")).toBeVisible();

  await page.getByRole("button", { name: "Check alerts" }).click();
  await expect(page.getByText("Inventory alert check completed: 2 active warning(s), 0 recovery update(s).")).toBeVisible();
});

test("operations overview surfaces stock attention and recent inventory activity", async ({ page }) => {
  await useAdminSession(page);
  await mockInventoryApi(page);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Good to see you, admin" })).toBeVisible();
  const kpis = page.locator(".stroane-portal-overview__kpis");
  await expect(kpis.getByText("Catalogue products", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Available units", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Reserved units", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Low stock", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Out of stock", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Supplier coverage" })).toBeVisible();
  await expect(page.getByText("2 item(s) need a closer look")).toBeVisible();
  await expect(page.getByText("Fridge Dial Thermometer")).toBeVisible();
  await expect(page.getByText("Latest inventory movements")).toBeVisible();
  await expect(page.getByText("RESTOCK", { exact: true })).toBeVisible();
  await expect(page.locator(".erp-nav-sidebar")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)"
  );
  const sidebarToggle = page.locator(".ui-sidebar-edge-toggle");
  await expect(sidebarToggle).toBeVisible();
  await expect(sidebarToggle).toHaveCSS("color", "rgb(37, 99, 235)");
  await expect(page.locator(".erp-nav-sidebar__brand-mark-image")).toHaveAttribute(
    "src",
    "/assets/logos/Emblem_logo-colour.png"
  );
  await sidebarToggle.click();
  const collapsedSidebar = page.locator(".erp-nav-sidebar");
  await expect(collapsedSidebar).toHaveClass(/is-collapsed/);
  await expect(page.locator(".stroane-admin-portal__sidebar-avatar")).toHaveText("A");
  await expect(page.locator(".stroane-admin-portal__sidebar-user-copy")).toBeHidden();
  await expect(page.getByRole("link", { name: "Open storefront" })).toBeVisible();
  const collapsedNavGeometry = await page.locator(".erp-nav-sidebar__nav").evaluate((nav) => {
    const navRect = nav.getBoundingClientRect();
    const iconRects = Array.from(nav.querySelectorAll(".erp-nav-sidebar__icon")).map((icon) =>
      icon.getBoundingClientRect()
    );
    return {
      clientWidth: nav.clientWidth,
      scrollWidth: nav.scrollWidth,
      iconsFit: iconRects.every(
        (iconRect) => iconRect.left >= navRect.left && iconRect.right <= navRect.right
      ),
    };
  });
  expect(collapsedNavGeometry.scrollWidth).toBeLessThanOrEqual(collapsedNavGeometry.clientWidth);
  expect(collapsedNavGeometry.iconsFit).toBe(true);
});

test("operations overview distinguishes an uncounted stock item from confirmed zero stock", async ({
  page,
}) => {
  await useAdminSession(page);
  await mockInventoryApi(page, {
    inventoryRows: [
      {
        ...inventory[0],
        id: "inventory-uncounted",
        quantityOnHand: null,
        reservedQuantity: 0,
        availableQuantity: null,
        stockStatus: "unavailable",
        computedStockStatus: "unavailable",
        isLowStock: false,
        needsReorder: false,
      },
    ],
  });
  await page.goto("/admin");

  const availableUnits = page
    .locator(".stroane-portal-overview__kpis a")
    .filter({ hasText: "Available units" });
  await expect(availableUnits.locator("strong")).toHaveText("Not set");
  await expect(availableUnits.locator("em")).toHaveText("1 stock counts awaiting entry");
  await expect(page.getByText("Quantity not confirmed")).toBeVisible();
});

test("inventory quantities remain adjustable on a mobile viewport", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await useAdminSession(page);
    await mockInventoryApi(page);
    await page.goto("/admin/inventory");

    await expect(page.getByRole("button", { name: "Check alerts" })).toBeVisible();
    await expect(page.getByText("2 product alert(s) need attention.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Products" })).toBeVisible();
    await expect(page.getByLabel("Mobile inventory list")).toBeVisible();
    await expect(page.locator(".admin-inventory-table--desktop-stock")).toBeHidden();

    const adjustQuantity = page.getByRole("button", { name: "Adjust quantity" }).first();
    await expect(adjustQuantity).toBeVisible();
    await adjustQuantity.click();

    const dialog = page.getByRole("dialog", { name: "Digital Probe Thermometer" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("spinbutton", { name: "Quantity" }).fill("2");
    await dialog.getByRole("button", { name: "Record movement" }).click();
    await expect(page.getByText("Restock recorded for Digital Probe Thermometer.")).toBeVisible();

    const viewportGeometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewportGeometry.scrollWidth).toBeLessThanOrEqual(viewportGeometry.clientWidth);
  } finally {
    await context.close();
  }
});

test("inventory dashboard shows an animated loading state while private stock loads", async ({ page }) => {
  test.setTimeout(75_000);
  await useAdminSession(page);
  await mockInventoryApi(page, { inventoryDelayMs: 30_000 });
  await page.goto("/admin/inventory");

  await expect(page.getByRole("status").filter({ hasText: "Loading inventory" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(".ui-animated-loading-state__skeleton")).toBeVisible();
  await expect(page.locator(".ui-animated-loading-state__skeleton-rows span")).toHaveCount(3);
  await expect(page.getByRole("table").getByText("Digital Probe Thermometer")).toBeVisible({
    timeout: 45_000,
  });
});
