import { expect, test } from "@playwright/test";
import { WATER_PRODUCTS } from "../shared/waterProducts.js";

const user = { id: 1, fullName: "Water Admin", role: "admin", email: "admin@reebs.test" };
const permissions = { canManagePricing: true, canOverridePrice: true, canViewCost: true, canViewFinance: true };

for (const [width, theme] of [[320, "dark"], [1440, "light"]] as const) {
  test(`sachet stock and sales remain separate at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
    const mutations: Record<string, unknown>[] = [];
    const dashboards = Object.fromEntries(WATER_PRODUCTS.map((product, index) => [product.key, {
      scope: "water", businessUnit: "WATER", products: WATER_PRODUCTS, permissions,
      product: { ...product, purchaseCost: index ? null : 2200, linkedVendorIds: [],
        pricing: { currency: "GHS", retailPrice: index ? 1200 : 2700,
          bulkPrice: index ? 1100 : 2600, companyPrice: index ? 1000 : 2500,
          bulkThreshold: 10, discountLimitBps: 1000 } },
      summary: {}, expenses: [], adjustments: [], sales: [],
      restocks: index ? [] : [{ id: 7, productKey: product.key, quantity: 10, unitCost: 2200, date: "2026-09-01" }],
    }]));
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(({ user, theme }) => {
      localStorage.setItem("reebs_auth_user", JSON.stringify(user));
      localStorage.setItem(`reebs_admin_preferences_${user.id}`, JSON.stringify({ theme }));
    }, { user, theme });
    await page.route(/^https:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.split("/").pop();
      if (endpoint === "session" || endpoint === "authSession") {
        return route.fulfill({ json: user });
      }
      if (endpoint === "customers") return route.fulfill({ json: [{ id: 1, name: "Water Customer", phone: "" }] });
      if (endpoint !== "water") return route.fulfill({ json: [] });
      const body = request.method() === "POST" ? request.postDataJSON() : null;
      const key = body?.productKey || url.searchParams.get("productKey") || "gwater-15pk";
      const dashboard = dashboards[key];
      expect(dashboard).toBeTruthy();
      if (body) {
        mutations.push(body);
        if (body.action === "restock") {
          const unitCost = Math.round(Number(body.unitCost) * 100);
          dashboard.product.purchaseCost = unitCost;
          dashboard.restocks.push({ id: 8, productKey: key, quantity: Number(body.quantity), unitCost, date: body.date });
        } else if (body.action === "sale") {
          dashboard.sales.push({ id: 9, productKey: key, quantity: Number(body.quantity),
            unitPrice: 1200, standardUnitPrice: 1200, unitCostAtSaleCents: 850,
            totalAmount: Number(body.quantity) * 1200, customerName: "Water Customer",
            paymentMethod: "cash", paymentStatus: "paid", date: body.date } as never);
        }
      }
      return route.fulfill({ json: dashboard });
    });
    await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Restock cost price per pack")).toHaveValue("22.00", { timeout: 90_000 });
    await expect(page.locator("html")).toHaveAttribute("data-admin-theme", theme);
    const picker = page.getByRole("button", { name: "Select Water product", exact: true });
    await picker.click();
    await page.getByRole("option", { name: "30pcs sachet water", exact: true }).click();
    await expect(page.getByText("30pcs sachet water: quantities and prices are per pack of 30.")).toBeVisible();
    await expect(page.getByLabel("Restock cost price per pack")).toHaveValue("");
    await expect(page.getByText("In stock", { exact: true }).locator("..").locator("strong")).toHaveText("0");
    await page.getByLabel("Restock quantity", { exact: true }).fill("5");
    await page.getByLabel("Restock cost price per pack").fill("8.50");
    await page.getByRole("button", { name: "Add 5 packs", exact: true }).click();
    await expect(page.getByText("In stock", { exact: true }).locator("..").locator("strong")).toHaveText("5");
    expect(mutations[0]).toMatchObject({ action: "restock", productKey: "sachet-water-30pk", unitCost: "8.50" });

    await page.getByRole("searchbox", { name: "Search or add customer name", exact: true }).fill("Water Customer");
    await page.getByRole("button", { name: /Water Customer/ }).first().click();
    await page.getByLabel("Sale quantity", { exact: true }).fill("2");
    await page.getByRole("button", { name: /^Record / }).click();
    await expect(page.getByText("In stock", { exact: true }).locator("..").locator("strong")).toHaveText("3");
    expect(mutations[1]).toMatchObject({ action: "sale", productKey: "sachet-water-30pk", quantity: "2" });
    await expect(page.locator(".water-module-kpi").filter({ hasText: "Water net profit" }).locator("strong")).toContainText("7.00");
    await page.evaluate(() => window.scrollTo(0, 0));
    const pickerBounds = await picker.boundingBox();
    const refreshBounds = await page.getByRole("button", { name: "Refresh Water dashboard" }).boundingBox();
    expect(pickerBounds!.x + pickerBounds!.width).toBeLessThanOrEqual(width);
    expect(refreshBounds!.x + refreshBounds!.width).toBeLessThanOrEqual(width);
    expect(pickerBounds!.x + pickerBounds!.width <= refreshBounds!.x
      || pickerBounds!.y + pickerBounds!.height <= refreshBounds!.y).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`sachet-selected-${width}-${theme}.png`) });

    // A partially entered stock cost must not silently travel to another product.
    await page.getByLabel("Restock cost price per pack").fill("9.00");
    page.once("dialog", (dialog) => dialog.dismiss());
    await picker.click();
    await page.getByRole("option", { name: "15pk Gwater", exact: true }).click();
    await expect(page.getByLabel("Restock cost price per pack")).toHaveValue("9.00");
    page.once("dialog", (dialog) => dialog.accept());
    await picker.click();
    await page.getByRole("option", { name: "15pk Gwater", exact: true }).click();
    await expect(page.getByLabel("Restock cost price per pack")).toHaveValue("22.00");
    await expect(page.getByText("In stock", { exact: true }).locator("..").locator("strong")).toHaveText("10");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`water-product-${width}-${theme}.png`), fullPage: true });
  });
}
