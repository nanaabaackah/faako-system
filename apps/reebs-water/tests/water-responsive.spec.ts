import { expect, test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";
import { openWaterModule } from "./navigation";

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
    pricing: { retailPrice: 2700, bulkPrice: 2600, companyPrice: 2500, bulkThreshold: 10 },
  },
  permissions: {
    canRecordSales: true,
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

for (const [width, theme] of [[320, "dark"], [1440, "light"]] as const) {
  test(`Water sidebar opens real modules and retains sales drafts at ${width}px`, async ({ page }, testInfo) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/");
    await expect(page.locator(".water-module-kpis")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Sale quantity", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Restock quantity", { exact: true })).toHaveCount(0);
    const toggle = page.getByRole("button", { name: "Water navigation", exact: true });
    if (await toggle.isVisible()) await toggle.click();
    const nav = page.getByRole("navigation", { name: "REEBS Water navigation", exact: true });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Orders", "Customers", "Stock"]);
    await page.screenshot({ path: testInfo.outputPath(`water-sidebar-${width}.png`), fullPage: true });
    await openWaterModule(page, "Sales");
    await page.getByLabel("Sale quantity", { exact: true }).fill("3");
    await expect(page.getByLabel("Restock quantity", { exact: true })).toHaveCount(0);
    await openWaterModule(page, "Orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Hide new order form", exact: true }).click();
    await expect(page.getByLabel("Sale quantity", { exact: true })).toHaveCount(0);
    await openWaterModule(page, "Sales");
    await expect(page.getByLabel("Sale quantity", { exact: true })).toHaveValue("3");
    await openWaterModule(page, "Customers");
    await expect(page.getByRole("heading", { name: "Customers", exact: true })).toBeVisible();
    await expect(page.getByLabel("Customer name", { exact: true })).toBeVisible();
    await openWaterModule(page, "Stock");
    await expect(page.getByLabel("Restock quantity", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Sale quantity", { exact: true })).toHaveCount(0);
    for (const disabled of [false, true]) {
      const opacities = await page.locator(".ui-dropdown-field__native, .ui-date-field__native").evaluateAll((nodes, nextDisabled) => nodes.map((node) => {
        (node as HTMLInputElement).disabled = nextDisabled;
        return Number(getComputedStyle(node).opacity);
      }), disabled);
      expect(opacities.length).toBeGreaterThan(0);
      expect(Math.max(...opacities)).toBeLessThanOrEqual(0.001);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`water-stock-fields-${width}.png`), fullPage: true });
    await page.reload();
    await expect(page.getByLabel("Restock quantity", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/stock$/);
  });
}

test("Customers module persists through the Water API and supports search and sorting", async ({ page }) => {
  await installFixtures(page);
  const writes = [];
  await page.route((url) => url.pathname.endsWith("/water"), async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: waterDashboard });
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { created: true, customer: { id: 73, name: "Test Water buyer", phone: "0200000000" } } });
  });
  await page.goto("/customers");
  await page.getByLabel("Customer name", { exact: true }).fill("Test Water buyer");
  await page.getByLabel("Phone", { exact: true }).fill("0200000000");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Test Water buyer", exact: true })).toBeVisible();
  expect(writes).toEqual([{ action: "create_customer", name: "Test Water buyer", phone: "0200000000" }]);
  await page.getByRole("searchbox", { name: "Search Water customers" }).fill("missing");
  await expect(page.getByText("No matching Water customers.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Water customers" }).fill("Test Water");
  await page.getByRole("button", { name: "Sort by Customer", exact: true }).click();
  await expect(page.locator('th[aria-sort="ascending"]')).toHaveText("Customer");
});

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
    await page.goto("/orders");
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
    await expect(card.getByRole("button", { name: "Previous", exact: true }).first().locator("svg path")).toHaveAttribute("stroke", "currentColor");
    await expect(card.getByRole("button", { name: "Previous", exact: true }).first()).toHaveCSS("border-radius", "999px");
    await expect(card.locator(".ui-search-field__input")).toHaveCSS("border-top-width", "0px");
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
  await page.goto("/");
  await expect(page.locator(".water-module-kpi").filter({ hasText: "Water revenue" }).locator("strong")).toContainText("54.00");
  await expect(page.locator(".water-module-kpi").filter({ hasText: "Water net profit" }).locator("strong")).toHaveText("Unavailable");
  await expect(page.getByText("Water stock costs", { exact: true }).locator("..").locator("dd")).toHaveText("Unavailable");
  await expect(page.getByText("Gross profit", { exact: true }).locator("..").locator("dd")).toHaveText("Unavailable");
});

test("new Water stock starts with an empty required purchase-cost input", async ({ page }) => {
  await installFixtures(page, adminUser, {
    ...waterDashboard, product: { ...waterDashboard.product, purchaseCost: null },
  });
  await page.goto("/stock");
  await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 30_000 });
  const cost = page.getByLabel("Purchase cost per pack");
  await expect(cost).toHaveValue("");
  await expect(cost).toHaveAttribute("required", "");
});

for (const width of [320, 768, 1440]) {
  test(`Water home navigation stays inside the standalone app at ${width}px`, async ({ page }) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 30_000 });
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    const home = breadcrumb.getByRole("link", { name: "REEBS Water", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    await home.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "REEBS Water home" })).toHaveAttribute("href", "/");
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
    const toggle = page.getByRole("button", { name: "Water navigation", exact: true });
    if (await toggle.isVisible()) await toggle.click();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

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
    await page.goto("/stock");
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
    await expect(dialog).toHaveCSS("position", "fixed");
    expect((await close.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await dialog.locator("form").evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft))).toBeGreaterThanOrEqual(16);
    const bodyGap = await dialog.locator("form").evaluate((form) => form.parentElement!.getBoundingClientRect().bottom - form.getBoundingClientRect().bottom);
    expect(bodyGap).toBeLessThanOrEqual(2);
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
    await dialog.getByRole("button", { name: "Save changes", exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeInViewport();
    await dialog.screenshot({ path: testInfo.outputPath(`water-restock-actions-${theme}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(row).toBeFocused();
  });
}

test("authorized Water price overrides do not require a recorded reason", async ({ page }) => {
  const mutations = [];
  await installFixtures(page, adminUser, waterDashboard, mutations);
  await page.goto("/sales");
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

test("Water renders in its standalone app shell without the Portal navigation", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "REEBS Water home" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Portal navigation" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
});

for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1440]) {
  test(`Water workspace fits the ${width}px viewport`, async ({ page }, testInfo) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/stock", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
    const restockCard = page.locator("article").filter({ hasText: "Restock water" });
    await expect(restockCard.getByLabel("Retail Price", { exact: true })).toHaveValue("27.00");
    await expect(restockCard.getByLabel("Company Price", { exact: true })).toHaveValue("25.00");
    await expect(restockCard.getByLabel("Bulk Price", { exact: true })).toHaveValue("26.00");
    await expect(page.getByLabel("Purchase cost per pack")).toHaveValue("22.00");
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
      canRecordSales: true,
      canManagePricing: false,
      canOverridePrice: false,
      canViewCost: false,
      canViewFinance: false,
    },
  };
  await installFixtures(page, waterUser, operationalDashboard);
  await page.goto("/stock");
  await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Purchase cost per pack")).toHaveCount(0);
  await expect(page.getByText("Internal — never exposed to storefront customers.")).toHaveCount(0);
});

test("managers see a read-only sales ledger without sale or archive controls", async ({ page }) => {
  await installFixtures(page, { ...adminUser, role: "manager" }, {
    ...waterDashboard,
    sales: [{ id: 91, date: "2026-09-26", customerName: "Read-only customer", quantity: 1, unitPrice: 2700, totalAmount: 2700, paymentStatus: "paid", paymentMethod: "cash" }],
    permissions: { canRecordSales: false, canManagePricing: false, canOverridePrice: false, canViewCost: false, canViewFinance: false },
  });
  await page.goto("/orders");
  await expect(page.getByRole("searchbox", { name: "Search orders" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "New order", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Archive water order/ })).toHaveCount(0);
  await expect(page.locator('[aria-label^="Edit water order"]')).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Search orders" })).toBeVisible();
});

test("missing selling prices stay blank while an explicitly configured zero is retained", async ({ page }) => {
  await installFixtures(page, adminUser, {
    ...waterDashboard,
    product: { ...waterDashboard.product, pricing: {
      ...waterDashboard.product.pricing, retailPrice: null, companyPrice: 0, bulkPrice: null,
    } },
  });
  await page.goto("/stock");
  await expect(page.getByLabel("Retail Price", { exact: true }).first()).toHaveValue("");
  await expect(page.getByLabel("Company Price", { exact: true }).first()).toHaveValue("0.00");
  await expect(page.getByLabel("Bulk Price", { exact: true }).last()).toHaveValue("");
});

test("recorded zero-price Water orders can be edited without native form validation blocking save", async ({ page }) => {
  const mutations = [];
  await installFixtures(page, adminUser, { ...waterDashboard,
    sales: [{ id: 95, customerId: 1, customerName: "Zero price customer", quantity: 1, unitPrice: 0, standardUnitPrice: 0, totalAmount: 0, paymentMethod: "cash", paymentStatus: "paid", saleChannel: "retail", date: "2026-09-26" }],
  }, mutations);
  await page.goto("/orders");
  await page.getByRole("row", { name: "Edit water order 95", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Order #95", exact: true });
  await expect(dialog.getByLabel("Sale price", { exact: true })).toHaveValue("0.00");
  await dialog.getByRole("button", { name: "Save order", exact: true }).click();
  await expect.poll(() => mutations.length).toBe(1);
  expect(mutations[0]).toMatchObject({ action: "update_sale", saleId: 95 });
});

for (const [width, theme] of [[320, "dark"], [1440, "light"]] as const) {
  test(`Water collection dialog preserves retry safety and Faako controls at ${width}px`, async ({ page }, testInfo) => {
    const sale = { id: 97, productKey: "gwater-15pk", customerId: 1, customerName: "Collection customer",
      quantity: 2, unitPrice: 3000, totalAmount: 6000, collectedCents: 0, amountPaidCents: 0,
      applicationCount: 0, balanceDueCents: 6000, paymentMethod: "credit", paymentStatus: "unpaid",
      date: "2026-09-26", updatedAt: "2026-09-26T12:00:00.000Z" };
    let dashboard = { ...waterDashboard, sales: [sale], collections: [] };
    await installFixtures(page, adminUser, dashboard);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const attempts: { key: string | undefined; body: Record<string, unknown> }[] = [];
    await page.route((url) => url.pathname.endsWith("/water"), async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        attempts.push({ key: request.headers()["idempotency-key"], body: request.postDataJSON() });
        if (attempts.length === 1) return route.fulfill({ status: 503, json: { error: "Temporary test failure" } });
        dashboard = { ...dashboard, sales: [{ ...sale, collectedCents: 2500, amountPaidCents: 2500,
          applicationCount: 1, balanceDueCents: 3500, paymentStatus: "partially_paid" }] };
      }
      return route.fulfill({ json: dashboard });
    });
    await page.goto("/orders");
    await page.getByRole("button", { name: "Record collection for sale 97", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Record collection · Sale #97", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Amount received (GHS)", { exact: true }).fill("25.00");
    expect(await page.evaluate(() => Boolean(document.elementFromPoint(30, 200)?.closest('[aria-labelledby="water-collection-title"]')))).toBe(true);
    await dialog.getByRole("button", { name: "Collection method", exact: true }).click();
    await page.getByRole("option", { name: "Manual Mobile Money", exact: true }).click();
    await dialog.getByLabel("Transaction reference", { exact: true }).fill("TEST-COLLECTION-97");
    const date = dialog.getByRole("button", { name: "Collection date", exact: true });
    await date.click();
    await expect(page.getByRole("dialog", { name: "Collection date", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(date).toBeFocused();
    await injectAxe(page);
    await checkA11y(page, '[aria-labelledby="water-collection-title"]', { detailedReport: true });
    await dialog.screenshot({ path: testInfo.outputPath(`water-collection-${theme}-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const submit = dialog.getByRole("button", { name: "Record collection", exact: true });
    await submit.click();
    await expect(dialog).toContainText("Temporary test failure");
    await submit.click();
    await expect(dialog).not.toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(attempts[0].key).toMatch(/^[A-Za-z0-9-]{12,}$/);
    expect(attempts[1].key).toBe(attempts[0].key);
    expect(attempts[0].body).toMatchObject({ action: "record_collection", productKey: "gwater-15pk",
      saleId: 97, amount: "25.00", method: "momo", transactionReference: "TEST-COLLECTION-97" });
  });
}

test("Water finance shows partial collections without counting them as extra revenue", async ({ page }) => {
  await installFixtures(page, adminUser, { ...waterDashboard,
    sales: [{ id: 96, customerName: "Partial customer", quantity: 2, unitPrice: 3000, totalAmount: 6000,
      amountPaidCents: 2500, collectedCents: 2500, applicationCount: 1, balanceDueCents: 3500,
      paymentMethod: "momo", paymentStatus: "partially_paid", date: "2026-09-26" }],
    collections: [{ applicationId: 1, saleId: 96, status: "PAID", applicationStatus: "APPLIED",
      amountCents: 2500, method: "Mobile Money", paidAt: "2026-09-26" }],
  });
  await page.goto("/");
  const finance = page.locator(".water-module-finance-breakdown");
  await expect(finance.getByText("Collected by payment date", { exact: true }).locator("..")).toContainText("25.00");
  await expect(finance.getByText("MoMo sales", { exact: true }).locator("..")).toContainText("35.00 pending");
  await expect(page.locator(".water-module-kpi").filter({ hasText: "Water revenue" })).toContainText("60.00");
  await expect(page.locator(".water-module-kpi").filter({ hasText: "Balance outstanding" })).toContainText("35.00");
});
