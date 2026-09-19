import { expect, test } from "@playwright/test";

test("storefront checkout submits a narrow idempotent public order request", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{
    name: "reebsCookieConsent_v2",
    value: "accepted",
    url: "http://127.0.0.1:5173",
  }]);
  const orderRequests: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
  let customerEndpointCalls = 0;

  await page.addInitScript(() => {
    sessionStorage.setItem("popupShown", "true");
    localStorage.setItem("currency", "GHS");
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.split("/").pop() || "";
    if (endpoint === "createOrder") {
      orderRequests.push({
        headers: request.headers(),
        body: request.postDataJSON(),
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          orderNumber: "ORD-20260830-099",
          status: "pending_payment",
          grandTotalCents: 5000,
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
});
