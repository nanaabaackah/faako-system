import { expect, test } from "@playwright/test";

const adminUser = {
  id: 1,
  firstName: "Water",
  lastName: "Admin",
  fullName: "Water Admin",
  role: "admin",
  email: "water-admin@reebs.test",
};

const buildDashboard = (unitCost = 2200) => ({
  scope: "water",
  businessUnit: "WATER",
  product: {
    key: "gwater-15pk",
    name: "15pk Gwater",
    inventoryProductId: null,
    linkedVendorIds: [],
    purchaseCost: unitCost,
    pricing: {
      currency: "GHS",
      retailSingle: 2700,
      retailBulk: 2600,
      company: 2500,
      bulkThreshold: 10,
      discountLimitBps: 9999,
    },
  },
  summary: {},
  restocks: [
    {
      id: 7,
      quantity: 10,
      unitCost,
      vendorName: "Ghana Water",
      date: "2026-08-01T00:00:00.000Z",
      createdAt: "2026-08-01T08:00:00.000Z",
    },
  ],
  sales: [
    {
      id: 9,
      quantity: 2,
      unitPrice: 3000,
      standardUnitPrice: 2700,
      priceOverrideReason: "Approved event rate",
      totalAmount: 6000,
      saleChannel: "retail",
      paymentMethod: "cash",
      paymentStatus: "paid",
      customerName: "Water Customer",
      date: "2026-08-02T00:00:00.000Z",
      createdAt: "2026-08-02T08:00:00.000Z",
    },
  ],
  expenses: [],
  adjustments: [],
});

const EXTERNAL_TELEMETRY_PATTERN =
  /^https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com|analytics\.google\.com)\//i;

const blockExternalTelemetry = async (page) => {
  await page.route(EXTERNAL_TELEMETRY_PATTERN, (route) => route.abort("blockedbyclient"));
};

const openWaterPage = async (page) => {
  await page.goto("/admin/water", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "GWater" })).toBeVisible();
  await expect(page.getByRole("row", { name: "Edit restock 7" })).toBeVisible();
};

test("an existing Water restock cost can be corrected and recalculates Water profit", async ({ page }) => {
  let dashboard = buildDashboard();
  let updatePayload: Record<string, unknown> | null = null;

  await page.addInitScript((user) => {
    window.localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, adminUser);

  await blockExternalTelemetry(page);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.toLowerCase();

    if (pathname.endsWith("/v1/auth/session") || pathname.endsWith("/authsession")) {
      await route.fulfill({ status: 200, json: adminUser });
      return;
    }
    if (pathname.endsWith("/water")) {
      if (request.method() === "POST") {
        updatePayload = request.postDataJSON();
        dashboard = buildDashboard(2450);
      }
      await route.fulfill({ status: 200, json: dashboard });
      return;
    }
    if (pathname.endsWith("/vendors") || pathname.endsWith("/customers")) {
      await route.fulfill({ status: 200, json: [] });
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  await openWaterPage(page);

  await expect(page.getByRole("heading", { name: "GWater" })).toBeVisible();
  await expect(page.getByLabel("Restock cost price per pack")).toHaveValue("22.00");
  await expect(page.getByText("Water stock costs").locator("..").locator("dd")).toContainText("44.00");

  await page.getByRole("row", { name: "Edit restock 7" }).click();
  const dialog = page.getByRole("dialog", { name: "Restock #7" });
  const recordedCostInput = dialog.getByLabel("Cost price per pack (GHS)");
  await expect(recordedCostInput).toHaveValue("22.00");
  await recordedCostInput.fill("24.50");
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Water restock updated.")).toBeVisible();
  expect(updatePayload).toMatchObject({
    action: "update_restock",
    restockId: 7,
    quantity: "10",
    unitCost: "24.50",
  });
  await expect(page.getByText("Water stock costs").locator("..").locator("dd")).toContainText("49.00");
  await expect(page.getByText("In stock").locator("..").locator("strong")).toHaveText("8");
});

test("an admin Water price change requires a reason and sends an auditable override", async ({ page }) => {
  let updatePayload: Record<string, unknown> | null = null;

  await page.addInitScript((user) => {
    window.localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, adminUser);
  await blockExternalTelemetry(page);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.toLowerCase();
    if (pathname.endsWith("/v1/auth/session") || pathname.endsWith("/authsession")) {
      await route.fulfill({ status: 200, json: adminUser });
      return;
    }
    if (pathname.endsWith("/water")) {
      if (request.method() === "POST") updatePayload = request.postDataJSON();
      await route.fulfill({ status: 200, json: buildDashboard() });
      return;
    }
    if (pathname.endsWith("/vendors") || pathname.endsWith("/customers")) {
      await route.fulfill({ status: 200, json: [] });
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  await openWaterPage(page);
  await page.getByRole("row", { name: "Edit water order 9" }).click();
  const dialog = page.getByRole("dialog", { name: "Order #9" });
  await dialog.getByLabel("Sale price").fill("31.00");
  await dialog.getByLabel("Price change reason").fill("Approved account correction");
  await dialog.getByRole("button", { name: "Save order" }).click();

  expect(updatePayload).toMatchObject({
    action: "update_sale",
    saleId: 9,
    unitPrice: "31.00",
    priceOverrideReason: "Approved account correction",
  });
});

test("a Water operator sees server prices but cannot edit them", async ({ page }) => {
  const waterUser = { ...adminUser, id: 2, role: "water", email: "operator@reebs.test" };
  await page.addInitScript((user) => {
    window.localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, waterUser);
  await blockExternalTelemetry(page);
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname.toLowerCase();
    if (pathname.endsWith("/v1/auth/session") || pathname.endsWith("/authsession")) {
      await route.fulfill({ status: 200, json: waterUser });
      return;
    }
    if (pathname.endsWith("/water")) {
      await route.fulfill({ status: 200, json: buildDashboard() });
      return;
    }
    if (pathname.endsWith("/vendors") || pathname.endsWith("/customers")) {
      await route.fulfill({ status: 200, json: [] });
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  await openWaterPage(page);
  await expect(page.getByLabel("Price Per Pack", { exact: true }))
    .toHaveAttribute("readonly", "");
  await page.getByRole("row", { name: "Edit water order 9" }).click();
  await expect(page.getByRole("dialog", { name: "Order #9" }).getByLabel("Sale price"))
    .toHaveAttribute("readonly", "");
});

test.describe("mobile Water route", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("renders its mocked dashboard without page-level horizontal overflow", async ({ page }) => {
    await page.addInitScript((user) => {
      window.localStorage.setItem("reebs_auth_user", JSON.stringify(user));
    }, adminUser);
    await blockExternalTelemetry(page);
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname.toLowerCase();
      if (pathname.endsWith("/v1/auth/session") || pathname.endsWith("/authsession")) {
        await route.fulfill({ status: 200, json: adminUser });
        return;
      }
      if (pathname.endsWith("/water")) {
        await route.fulfill({ status: 200, json: buildDashboard() });
        return;
      }
      if (pathname.endsWith("/vendors") || pathname.endsWith("/customers")) {
        await route.fulfill({ status: 200, json: [] });
        return;
      }
      await route.fulfill({ status: 200, json: {} });
    });

    await openWaterPage(page);
    await expect(page.getByLabel("Restock cost price per pack")).toBeVisible();

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  });
});
