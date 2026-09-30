import { expect, test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";

const adminUser = {
  id: 1,
  firstName: "Admin",
  lastName: "User",
  fullName: "Admin User",
  role: "admin",
  email: "admin@reebs.test",
};

const waterDashboard = {
  product: {
    key: "gwater-15pk",
    name: "15pk Gwater",
    inventoryProductId: 9,
    linkedVendorIds: [],
    purchaseCost: 2200,
    pricingConfigured: true,
    pricing: { retailSingle: 2700, retailBulk: 2600, company: 2500, bulkThreshold: 10 },
  },
  permissions: {
    canManagePricing: true,
    canOverridePrice: true,
    canViewCost: true,
    canViewFinance: true,
  },
  summary: {
    stockOnHand: 10,
    unitsRestocked: 10,
    unitsSold: 0,
    adjustmentUnits: 0,
    revenue: 0,
    restockSpend: 22000,
    extraExpenses: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    netProfit: 0,
    cashCollected: 0,
    outstandingCredit: 0,
    cashSalesTotal: 0,
    momoSalesTotal: 0,
    pendingCash: 0,
    pendingMomo: 0,
    cashPosition: -22000,
    inventoryValue: 22000,
    profitabilityAvailable: true,
    missingCostSaleCount: 0,
  },
  restocks: [],
  sales: [],
  expenses: [],
  adjustments: [],
};

const installFixtures = async (page, user = adminUser, dashboard = waterDashboard, mutations = []) => {
  await page.addInitScript((authUser) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(authUser));
  }, user);
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    if (endpoint === "water" && route.request().method() !== "GET") {
      mutations.push(route.request().postDataJSON());
    }
    const payload = ["authSession", "session"].includes(endpoint || "") ? user : endpoint === "water" ? dashboard : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
};

for (const width of [390, 1440]) {
  test(`populated Water ledgers sort before pagination and keep totals at ${width}px`, async ({ page }, testInfo) => {
    const dashboard = {
      ...waterDashboard,
      sales: Array.from({ length: 12 }, (_, index) => ({
        id: index + 1, date: "2026-09-26T10:00:00Z", customerName: `Customer ${index + 1}`,
        quantity: index + 1, unitPrice: 2700, totalAmount: (index + 1) * 2700,
        paymentStatus: "paid", paymentMethod: "cash",
      })),
    };
    await installFixtures(page, adminUser, dashboard);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/water");
    const card = page.locator(".water-module-table-card--orders");
    await expect(card.locator("tbody tr")).toHaveCount(10, { timeout: 30_000 });
    await expect(card.getByText("Showing 1-10 of 12").first()).toBeVisible();
    // Headers are hidden in the existing mobile card layout; sorting is tested
    // at desktop, while the populated mobile view is checked for overflow.
    if (width === 1440) {
      await card.getByRole("button", { name: "Sort by Qty", exact: true }).click();
      await expect(card.locator('tbody tr').first().locator('[data-label="Qty"]')).toHaveText("1");
      await card.getByRole("button", { name: "Sort by Qty", exact: true }).click();
      await expect(card.locator('tbody tr').first().locator('[data-label="Qty"]')).toHaveText("12");
      await expect(card.locator('th[aria-sort="descending"]')).toHaveText("Qty");
    }
    await card.getByRole("button", { name: "Next", exact: true }).last().click();
    await expect(card.locator("tbody tr")).toHaveCount(2);
    await expect(card.getByText("Showing 11-12 of 12").first()).toBeVisible();
    await expect(card.locator("tfoot")).toContainText("12 orders");
    await expect(card.locator('input[type="checkbox"]')).toHaveCount(0);
    const paginationOverflow = await card.locator(".table-pagination").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth));
    expect(Math.max(...paginationOverflow)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await card.screenshot({ path: testInfo.outputPath(`water-ledger-${width}.png`) });
  });
}

test("Water never substitutes a current purchase price for missing historical sale costs", async ({ page }) => {
  await installFixtures(page, adminUser, {
    ...waterDashboard,
    restocks: [{ id: 1, quantity: 10, unitCost: 2200, date: "2026-09-01T00:00:00Z" }],
    sales: [{ id: 1, quantity: 2, unitPrice: 2700, totalAmount: 5400,
      paymentMethod: "cash", paymentStatus: "paid", date: "2026-09-02T00:00:00Z" }],
  });
  await page.goto("/admin/water");
  await expect(page.locator(".water-module-kpi").filter({ hasText: "Water revenue" }).locator("strong")).toContainText("54.00");
  await expect(page.locator(".water-module-kpi").filter({ hasText: "Water net profit" }).locator("strong")).toHaveText("Unavailable");
  await expect(page.getByText("Water stock costs", { exact: true }).locator("..").locator("dd")).toHaveText("Unavailable");
  await expect(page.getByText("Gross profit", { exact: true }).locator("..").locator("dd")).toHaveText("Unavailable");
});

test("new Water stock starts with an empty required purchase-cost input", async ({ page }) => {
  await installFixtures(page, adminUser, {
    ...waterDashboard, product: { ...waterDashboard.product, purchaseCost: null },
  });
  await page.goto("/admin/water");
  const cost = page.getByLabel("Restock cost price per pack");
  await expect(cost).toHaveValue("");
  await expect(cost).toHaveAttribute("required", "");
});

for (const theme of ["light", "dark"]) {
  test(`Water ${theme} theme supports a keyboard restock dialog without automated accessibility violations`, async ({ page }, testInfo) => {
    await installFixtures(page, adminUser, {
      ...waterDashboard,
      restocks: [{ id: 1, quantity: 10, unitCost: 2200, date: "2026-09-01T00:00:00Z" }],
    });
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("reebs_admin_preferences_1", JSON.stringify({ theme: selectedTheme, fontSize: "default" }));
    }, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/water");
    await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("data-admin-theme", theme);
    const row = page.getByRole("row", { name: "Edit restock 1", exact: true });
    await expect(row).toBeVisible();
    await injectAxe(page);
    await checkA11y(page, ".water-module-page", { detailedReport: true });
    await row.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Restock #1", exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    const vendor = dialog.getByRole("button", { name: "Link vendor", exact: true });
    await vendor.click();
    await expect(page.getByRole("listbox", { name: "Link vendor", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox", { name: "Link vendor", exact: true })).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(vendor).toBeFocused();
    await vendor.click();
    await expect(page.getByRole("listbox", { name: "Link vendor", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "No link", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("listbox", { name: "Link vendor", exact: true })).toHaveCount(0);
    await expect(vendor).toBeFocused();
    await vendor.click();
    await expect(page.getByRole("listbox", { name: "Link vendor", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "No link", exact: true })).toBeFocused();
    await vendor.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("listbox", { name: "Link vendor", exact: true })).toHaveCount(0);
    await expect(vendor).toBeFocused();
    await expect(dialog.getByLabel("Cost price per pack (GHS)")).toHaveValue("22.00");
    await checkA11y(page, '[role="dialog"]', { detailedReport: true });
    await dialog.screenshot({ path: testInfo.outputPath(`water-restock-${theme}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(row).toBeFocused();
  });
}

test("authorized Water price overrides do not require a recorded reason", async ({ page }) => {
  const mutations = [];
  await installFixtures(page, adminUser, waterDashboard, mutations);
  await page.goto("/admin/water");
  await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("searchbox", { name: "Search or add customer name" }).fill("Walk-in customer");
  await page.getByRole("spinbutton", { name: "Sale quantity", exact: true }).fill("1");
  await page.getByRole("spinbutton", { name: "Price Per Pack", exact: true }).fill("25.00");
  await expect(page.getByText("Price override reason")).toHaveCount(0);
  await expect(page.getByText("Overrides are audited.")).toHaveCount(0);
  await page.getByRole("button", { name: "Record GH₵25.00" }).click();

  await expect.poll(() => mutations.length).toBe(1);
  expect(mutations[0]).toMatchObject({ action: "sale", unitPrice: "25.00" });
  expect(mutations[0]).not.toHaveProperty("priceOverrideReason");
});

test("Water route loading stays inside the existing portal design", async ({ page }) => {
  await installFixtures(page);
  let releaseChunk;
  const chunkReady = new Promise((resolve) => { releaseChunk = resolve; });
  await page.route("**/src/pages/AdminWater/AdminWater.jsx*", async (route) => {
    await chunkReady;
    await route.continue();
  });

  try {
    await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("complementary", { name: "Portal navigation" })).toHaveCount(1);
    const loading = page.locator(".portal-app-content").getByRole("status").filter({ hasText: "Loading page" });
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("data-layout", "portal");
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(loading.locator(".ui-animated-loading-state__page-skeleton")).toBeVisible();
  } finally {
    releaseChunk();
  }
  await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
});

for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1440]) {
  test(`Water workspace fits the ${width}px viewport`, async ({ page }, testInfo) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
    const restockCard = page.locator("article").filter({ hasText: "Pricing & Restock" });
    await expect(restockCard.getByText("Current scheduled retail price")).toBeVisible();
    await expect(restockCard.getByText("GH₵27.00", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Restock cost price per pack")).toHaveValue("22.00");
    await expect(page.locator(".water-module-kpi")).toHaveCount(4);

    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
      water: (() => {
        const page = document.querySelector(".water-module-page");
        return page ? page.scrollWidth - page.clientWidth : 0;
      })(),
    }));
    expect(overflow.html).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.water).toBeLessThanOrEqual(1);
    if ([320, 768, 1440].includes(width)) {
      await page.screenshot({ path: testInfo.outputPath(`water-${width}.png`), fullPage: true });
    }
  });
}

test("operational Water users cannot see internal cost or pricing controls", async ({ page }) => {
  const waterUser = { ...adminUser, id: 2, role: "water", email: "water@reebs.test" };
  const operationalDashboard = {
    ...waterDashboard,
    product: {
      ...waterDashboard.product,
      purchaseCost: undefined,
    },
    permissions: {
      canManagePricing: false,
      canOverridePrice: false,
      canViewCost: false,
      canViewFinance: false,
    },
  };
  await installFixtures(page, waterUser, operationalDashboard);
  await page.goto("/admin/water");
  await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Restock cost price per pack")).toHaveCount(0);
  await expect(page.getByText("Internal — never exposed to storefront customers.")).toHaveCount(0);
});
