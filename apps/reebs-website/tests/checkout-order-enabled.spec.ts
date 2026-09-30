import { expect, test } from "@playwright/test";
import { REEBS_PUBLIC_COMMERCE } from "@faako/config";
import { buildPublicCheckoutQuote, assertCheckoutQuoteGuard } from "../../reebs-portal/backend/functions/_shared/checkoutQuote.js";

for (const changedPrice of [false, true]) {
test(`storefront checkout ${changedPrice ? "requires review when quoted prices change" : "submits a narrow idempotent public order request"}`, async ({ page }) => {
  test.skip(!REEBS_PUBLIC_COMMERCE.checkoutEnabled, "Public commerce is intentionally paused; retain these checks for an approved reopening.");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{
    name: "reebsCookieConsent_v2",
    value: "accepted",
    url: "http://127.0.0.1:5173",
  }]);
  const orderRequests: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
  let customerEndpointCalls = 0;
  let unitPriceCents = changedPrice ? 6000 : 5000;
  let quoteRequests = 0;
  const authoritativeQuote = (items: Array<{ productId: number; variantId?: number; quantity: number }>) => ({
    currency: "GHS",
    items: items.map((item) => ({ productId: item.productId, variantId: item.variantId || null,
      name: "Rainbow Balloon Set", quantity: item.quantity, unitPriceCents, lineTotalCents: unitPriceCents * item.quantity })),
    subtotalCents: items.reduce((sum, item) => sum + item.quantity * unitPriceCents, 0),
    grandTotalCents: items.reduce((sum, item) => sum + item.quantity * unitPriceCents, 0),
    discountCents: 0, deliveryFeeCents: 0, serviceFeeCents: 0, deliveryMethod: "pickup",
  });

  await page.addInitScript(() => {
    sessionStorage.setItem("popupShown", "true");
    localStorage.setItem("currency", "GHS");
  });

  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.split("/").pop() || "";
    if (endpoint === "checkoutQuote") {
      quoteRequests += 1;
      const body = request.postDataJSON();
      const quote = buildPublicCheckoutQuote({ organizationId: 1, quote: authoritativeQuote(body.items), expectedItems: body.items });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quote) });
      return;
    }
    if (endpoint === "createOrder") {
      const body = request.postDataJSON();
      orderRequests.push({
        headers: request.headers(),
        body,
      });
      if (!body.quoteFingerprint) {
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "A current checkout quote is required.", code: "CHECKOUT_QUOTE_REQUIRED" }) });
        return;
      }
      // Use the real server's pure stale-price guard, not an unconditional 201.
      assertCheckoutQuoteGuard({ organizationId: 1, quote: authoritativeQuote(body.items), expectedItems: body.items,
        expectedFingerprint: body.quoteFingerprint, acknowledgePriceChanges: body.acknowledgePriceChanges });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          orderNumber: "ORD-20260830-099",
          status: "pending_payment",
          grandTotalCents: unitPriceCents,
          paymentStatus: "unpaid",
        }),
      });
      return;
    }
    if (endpoint === "customers") customerEndpointCalls += 1;
    const payload = endpoint === "inventory" ? [{
      id: 1,
      name: "Rainbow Balloon Set",
      specificCategory: "Party Supplies",
      sourceCategoryCode: "INVENTORY",
      price: 50,
      quantity: 4,
      description: "Colorful balloons",
      image: "/imgs/placeholder.png",
    }] : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/shop", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Rainbow Balloon Set", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  const addToCart = page.getByRole("button", { name: "Add to cart" }).first();
  await expect(addToCart).toBeVisible({ timeout: 60_000 });
  await expect.poll(
    () => addToCart.evaluate((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactProps$"))
    ),
    { timeout: 60_000 },
  ).toBe(true);
  await addToCart.click();
  await expect.poll(() => page.evaluate(() => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    return cart.length;
  })).toBe(1);

  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Finalize your bag" })).toBeVisible({
    timeout: 60_000,
  });
  const today = new Date();
  const pickupDate = new Date(today);
  pickupDate.setDate(today.getDate() + 2);
  await page.getByRole("button", { name: "Pickup date" }).click();
  const dateDialog = page.getByRole("dialog", { name: "Pickup date" });
  await expect(dateDialog).toBeVisible();
  if (pickupDate.getMonth() !== today.getMonth() || pickupDate.getFullYear() !== today.getFullYear()) {
    await dateDialog.getByRole("button", { name: "Next month" }).click();
  }
  await dateDialog.locator("button.ui-date-field__day:not(.is-outside)", {
    hasText: new RegExp(`^${pickupDate.getDate()}$`),
  }).click();
  await page.getByRole("button", { name: "Pickup time window" }).click();
  await page.getByRole("option", { name: "11:00am – 1:00pm" }).click();
  await page.getByRole("button", { name: "Confirm order" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("Ama Mensah");
  await dialog.getByLabel("Email address").fill("ama@example.com");
  await dialog.getByLabel("10-digit phone number").fill("0244123456");
  await dialog.getByRole("button", { name: "Confirm order" }).click();

  if (changedPrice) {
    await expect(dialog.getByRole("status")).toContainText("Review the current shop total");
    await expect(dialog.locator(".checkout-modal-amount")).toContainText("60.00");
    expect(orderRequests).toHaveLength(0);
    unitPriceCents = 7000;
    await dialog.getByRole("button", { name: "Confirm order" }).click();
    await expect(dialog.locator(".checkout-modal-amount")).toContainText("70.00");
    expect(orderRequests).toHaveLength(0);
    await dialog.getByRole("button", { name: "Confirm order" }).click();
  }

  await expect(page.getByText(/Order ORD-20260830-099 confirmed/)).toBeVisible();
  expect(customerEndpointCalls).toBe(0);
  expect(orderRequests).toHaveLength(1);
  expect(orderRequests[0].headers["idempotency-key"]).toMatch(/^shop-.{8,}$/);
  expect(orderRequests[0].body).toMatchObject({
    customer: {
      name: "Ama Mensah",
      email: "ama@example.com",
      phone: "+233 244123456",
    },
    deliveryMethod: "pickup",
  });
  expect(orderRequests[0].body).not.toHaveProperty("customerId");
  expect(orderRequests[0].body).not.toHaveProperty("source");
  expect(orderRequests[0].body.quoteFingerprint).toMatch(/^v1\.[a-f0-9]{64}$/);
  expect(orderRequests[0].body.acknowledgePriceChanges).toBe(changedPrice);
  expect(orderRequests[0].body.items).toEqual([{ productId: 1, quantity: 1, expectedUnitPriceCents: 5000 }]);
  expect(quoteRequests).toBe(changedPrice ? 3 : 1);
});
}
