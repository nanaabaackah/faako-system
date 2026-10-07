import { expect, test } from "@playwright/test";

const user = { id: 1, fullName: "Water Admin", role: "admin", email: "admin@reebs.test" };
const permissions = { canManagePricing: true, canOverridePrice: true, canViewCost: true, canViewFinance: true };

test("Water shows current prices and restock can update selected prices", async ({ page }) => {
  const writes: Record<string, unknown>[] = [];
  let dashboard = {
    scope: "water",
    businessUnit: "WATER",
    permissions,
    products: [{ key: "gwater-15pk", name: "15pk Gwater", packSize: 15, unit: "pack" }],
    product: {
      key: "gwater-15pk",
      name: "15pk Gwater",
      linkedVendorIds: [],
      purchaseCost: 2200,
      pricingConfigured: true,
      pricing: { currency: "GHS", retailPrice: 2700, companyPrice: 2500, bulkPrice: 2600, bulkThreshold: 10 },
    },
    summary: { stockOnHand: 10, unitsRestocked: 10, unitsSold: 0, adjustmentUnits: 0 },
    restocks: [{ id: 1, quantity: 10, unitCost: 2200, date: "2026-09-01" }],
    sales: [],
    expenses: [],
    adjustments: [],
    priceHistory: [],
  };

  await page.addInitScript((authUser) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(authUser));
  }, user);
  await page.route(/^https:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.split("/").pop();
    if (["session", "authSession"].includes(endpoint || "")) return route.fulfill({ json: user });
    if (endpoint === "water" && request.method() === "POST") {
      const payload = request.postDataJSON();
      writes.push(payload);
      dashboard = {
        ...dashboard,
        product: {
          ...dashboard.product,
          pricing: {
            ...dashboard.product.pricing,
            retailPrice: 3100,
          },
        },
        priceHistory: [{
          id: 1, priceType: "retail", previousPriceCents: 2700, newPriceCents: 3100,
          changedAt: "2026-10-01T12:00:00Z", changedByName: "Water Admin", source: "restock",
        }],
      };
      return route.fulfill({ json: dashboard });
    }
    if (endpoint === "water") return route.fulfill({ json: dashboard });
    return route.fulfill({ json: [] });
  });

  await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Current Water prices")).toBeVisible();
  await expect(page.getByLabel("Retail Price", { exact: true }).first()).toHaveValue("27.00");
  await expect(page.getByLabel("Company Price", { exact: true }).first()).toHaveValue("25.00");
  await expect(page.getByLabel("Bulk Price", { exact: true }).first()).toHaveValue("26.00");
  await expect(page.getByLabel("Purchase cost per pack")).toHaveValue("22.00");
  await expect(page.getByText(/schedule|upcoming price|effective date/i)).toHaveCount(0);

  await page.getByLabel("Restock quantity", { exact: true }).fill("4");
  await page.getByLabel("Retail Price", { exact: true }).last().fill("31.00");
  await page.getByRole("button", { name: "Add 4 packs", exact: true }).click();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    action: "restock",
    quantity: "4",
    unitCost: "22.00",
    retailPrice: "31.00",
    companyPrice: "25.00",
    bulkPrice: "26.00",
  });
  await expect(page.getByText("Recent price changes")).toBeVisible();
  await expect(page.getByText(/27\.00 → .*31\.00/)).toBeVisible();
});
