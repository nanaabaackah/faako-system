import { expect, test } from "@playwright/test";

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
  await page.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    if (endpoint === "water" && route.request().method() !== "GET") {
      mutations.push(route.request().postDataJSON());
    }
    const payload = endpoint === "authSession" ? user : endpoint === "water" ? dashboard : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
};

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
  await page.route("**/src/pages/AdminWater/AdminWater.jsx*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    await route.continue();
  });

  await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("complementary", { name: "Portal navigation" })).toHaveCount(1);
  await expect(page.locator(".ui-animated-loading-state.is-page")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Loading Water" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
});

for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1440]) {
  test(`Water workspace fits the ${width}px viewport`, async ({ page }) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "GWater" })).toBeVisible({ timeout: 15_000 });
    const restockCard = page.locator("article").filter({ hasText: "Pricing & Restock" });
    await expect(restockCard.getByText("Current scheduled retail price")).toBeVisible();
    await expect(restockCard.getByText("GH₵27.00", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Restock cost price per pack")).toHaveValue("22.00");

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
