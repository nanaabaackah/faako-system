import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify([]),
  }));
  await page.addInitScript(() => {
    sessionStorage.setItem("popupShown", "true");
    localStorage.setItem("cart", JSON.stringify([
      { id: 1, name: "Saved shop item", cartKind: "shop", price: 50, quantity: 5, cartQuantity: 1 },
      { id: 2, name: "Saved rental", cartKind: "rental", price: 700, quantity: 2, cartQuantity: 1 },
    ]));
    localStorage.setItem("publicCommerceEnabled", "true");
  });
});

for (const width of [390, 1440]) {
  test(`public checkout and booking are paused, including saved carts, at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/(?:createOrder|bookings|checkoutQuote|v1\/checkout\/orders|v1\/bookings)(?:\?|$)/.test(request.url())) mutations.push(request.url());
    });
    for (const [route, heading] of [
      ["/checkout?publicCommerceEnabled=true", "Online checkout is paused"],
      ["/book?rental=bouncycastle&publicCommerceEnabled=true", "Online rental bookings are paused"],
    ]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
      await expect(page.getByRole("button", { name: /Confirm order|Request booking/ })).toHaveCount(0);
      await expect(page.locator('form[name="rental-booking"]')).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Contact REEBS", exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
    expect(mutations).toEqual([]);
  });
}
