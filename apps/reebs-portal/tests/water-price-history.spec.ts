import { expect, test } from "@playwright/test";

const user = { id: 1, fullName: "Water Admin", role: "admin", email: "admin@reebs.test" };
const current = { id: 2, productKey: "gwater-15pk", productName: "15pk Gwater", priceType: "RETAIL", minimumQuantity: 1, priceCents: 3500, currency: "GHS", active: true, effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveTo: null };
const historical = { ...current, id: 1, priceCents: 3000, effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: "2026-09-01T00:00:00.000Z" };

for (const width of [320, 768, 1440]) for (const theme of ["light", "dark"]) {
  test(`historical Water schedule is usable at ${width}px in ${theme}`, async ({ page }, testInfo) => {
    const writes: Record<string, unknown>[] = [];
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
    await page.addInitScript(({ user, theme }) => {
      localStorage.setItem("reebs_auth_user", JSON.stringify(user));
      localStorage.setItem(`reebs_admin_preferences_${user.id}`, JSON.stringify({ theme }));
    }, { user, theme });
    await page.route(/^https:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
      const url = new URL(route.request().url());
      const endpoint = url.pathname.split("/").pop();
      if (["session", "authSession"].includes(endpoint || "")) return route.fulfill({ json: user });
      if (endpoint === "commercial-config") {
        if (route.request().method() === "POST") {
          writes.push(route.request().postDataJSON());
          return route.fulfill({ status: 201, json: { record: writes.at(-1) } });
        }
        return route.fulfill({ json: {
          asOf: "2026-10-04T12:00:00Z", definitions: [], rules: [],
          waterPrices: url.searchParams.get("view") === "history" ? [current, historical] : [current],
        } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/settings?tab=commercial");
    const form = page.locator("form.settings-commercial-row--water").first();
    const start = form.getByRole("button", { name: "Effective date for gwater-15pk:RETAIL", exact: true });
    await start.click();
    let calendar = page.getByRole("dialog", { name: "Effective date for gwater-15pk:RETAIL", exact: true });
    await calendar.getByRole("button", { name: "Previous month" }).click();
    await calendar.locator(".ui-date-field__day:not(.is-outside)").filter({ hasText: /^1$/ }).click();
    await expect(form.getByRole("note")).toContainText("Historical price schedule");
    await expect(form.getByRole("note")).toContainText("Existing recorded transactions will not be changed");
    await form.getByRole("spinbutton", { name: "Price", exact: true }).fill("28");
    const end = form.getByRole("button", { name: "Effective date for gwater-15pk:RETAIL end (exclusive)", exact: true });
    await end.click();
    calendar = page.getByRole("dialog", { name: "Effective date for gwater-15pk:RETAIL end (exclusive)", exact: true });
    await calendar.getByRole("button", { name: "Today", exact: true }).click();
    await start.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(start).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const controls = await form.locator(".ui-date-field__trigger, input:not([aria-hidden=true]), button[type=submit]").evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width };
    }));
    for (const box of controls) { expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width); }
    await form.screenshot({ path: testInfo.outputPath(`water-period-${width}-${theme}.png`) });
    await form.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ resourceType: "water_price", effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveTo: "2026-10-04T00:00:00.000Z", priceCents: 2800 });
    await page.getByRole("button", { name: "Price period view" }).click();
    await page.getByRole("option", { name: "History (all periods)" }).click();
    await form.locator("summary").filter({ hasText: "Price periods" }).click();
    await expect(form.getByText(/GHS 30.00 · Minimum/)).toBeVisible();
    await page.getByText("Add a Water price schedule", { exact: true }).click();
    await page.getByRole("button", { name: "New Water price effective date", exact: true }).click();
    calendar = page.getByRole("dialog", { name: "New Water price effective date", exact: true });
    await calendar.getByRole("button", { name: "Previous month" }).click();
    await calendar.locator(".ui-date-field__day:not(.is-outside)").filter({ hasText: /^1$/ }).click();
    await expect(page.locator(".settings-commercial-new-water").getByRole("note")).toContainText("Historical price schedule");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
