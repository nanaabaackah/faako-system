import { expect, test, type Page } from "@playwright/test";

const adminUser = {
  id: 1,
  organizationId: 1,
  fullName: "Admin User",
  role: "admin",
  email: "admin@reebs.test",
};

const order = {
  id: 41,
  organizationId: 1,
  orderNumber: "ORD-20260830-041",
  customerId: 21,
  customerName: "Ama Mensah",
  customerEmail: "ama@example.com",
  customerPhone: "+233244123456",
  status: "paid",
  paymentStatus: "paid",
  fulfillmentStatus: "not_started",
  deliveryMethod: "pickup",
  fulfillmentMethod: "Pickup",
  deliveryRequired: false,
  subtotalCents: 12500,
  grandTotalCents: 12500,
  amountPaidCents: 12500,
  balanceDueCents: 0,
  orderDate: "2026-08-30T10:00:00.000Z",
  items: [{
    id: 1,
    productId: 101,
    quantity: 1,
    unit_price: 12500,
    total_amount: 12500,
    productName: "Party cups",
    sku: "SHOP-101",
  }],
  payments: [{
    id: 1,
    amountCents: 12500,
    method: "Mobile Money",
    status: "successful",
    paidAt: "2026-08-30T10:05:00.000Z",
  }],
  receipts: [{
    id: 1,
    receiptNumber: "REC-20260830-001",
    amountCents: 12500,
    issuedAt: "2026-08-30T10:05:00.000Z",
  }],
  events: [],
  stockMovements: [],
  expenses: [],
  nextActions: {
    fulfillmentTransitions: ["preparing"],
    orderTransitions: ["processing", "cancelled"],
    requiresPayment: false,
  },
};

const installOrderApi = async (page: Page) => {
  let currentOrder = structuredClone(order);
  const fulfillmentBodies: Array<Record<string, unknown>> = [];

  await page.addInitScript((user) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, adminUser);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.split("/").pop() || "";
    if (endpoint === "authSession") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminUser) });
      return;
    }
    if (endpoint === "orders") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        fulfillmentBodies.push(body);
        currentOrder = {
          ...currentOrder,
          status: "processing",
          fulfillmentStatus: "preparing",
          nextActions: {
            fulfillmentTransitions: ["ready_for_pickup"],
            orderTransitions: ["ready_for_pickup", "cancelled"],
            requiresPayment: false,
          },
        };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentOrder) });
        return;
      }
      const payload = url.searchParams.get("id")
        ? currentOrder
        : { items: [currentOrder], total: 1, page: 1, pageSize: 50 };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
      return;
    }
    if (endpoint === "orderPayments") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  return { fulfillmentBodies };
};

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`order detail exposes only the next valid pickup step on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const state = await installOrderApi(page);
    await page.goto(`/admin/orders/${order.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: order.orderNumber })).toBeVisible({
      timeout: 60_000,
    });
    const nextStep = page.getByLabel("Next fulfillment step");
    await expect(nextStep).toHaveValue("preparing");
    await expect(nextStep.locator('option[value="delivered"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Mark Preparing" }).click();
    await expect.poll(() => state.fulfillmentBodies).toEqual([
      { id: order.id, fulfillmentStatus: "preparing" },
    ]);
    await expect(page.getByRole("button", { name: "Mark Ready For Pickup" })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.html).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
  });
}
