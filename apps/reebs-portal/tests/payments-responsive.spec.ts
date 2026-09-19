import { expect, test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";

const adminUser = {
  id: 1,
  organizationId: 1,
  fullName: "Admin User",
  role: "admin",
  email: "admin@reebs.test",
};

const paymentResponse = {
  businessUnit: "REEBS_CORE",
  pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  items: [{
    id: 12,
    paymentReference: "REEBS-PAY-000012",
    amountCents: 12500,
    currency: "GHS",
    method: "Mobile Money",
    provider: "MTN",
    providerReference: "MOMO-123",
    verificationStatus: "MANUAL_RECORDED",
    source: "MANUAL",
    status: "successful",
    paidAt: "2026-09-03T10:00:00.000Z",
    customer: { id: 4, name: "Ama Mensah", phone: "+233244123456" },
    relatedRecord: { type: "ORDER", id: 9, reference: "ORD-9" },
    businessUnit: "REEBS_CORE",
  }],
};

const installFixtures = async (page) => {
  await page.addInitScript((user) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, adminUser);
  await page.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    const payload = endpoint === "authSession"
      ? adminUser
      : endpoint === "payments"
        ? paymentResponse
        : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
};

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`Core payment register fits ${width}px and keeps Water visibly separate`, async ({ page }) => {
    await installFixtures(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/admin/payments", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Water remains in Water Business/i)).toBeVisible();
    await expect(page.getByText("REEBS-PAY-000012")).toBeVisible();
    await expect(page.locator('tbody td[data-label="Type / source"]')).toHaveText("Manual");
    const paginationRanges = page.getByText("Showing 1-1 of 1");
    const paginationPages = page.getByText("Page 1 of 1");
    await expect(paginationRanges).toHaveCount(2);
    await expect(paginationRanges.first()).toBeVisible();
    await expect(paginationPages).toHaveCount(2);
    await expect(paginationPages.first()).toBeVisible();

    if (width <= 620) {
      const headerSpacing = await page.evaluate(() => {
        const copy = document.querySelector(".payments-header-copy")?.getBoundingClientRect();
        const actions = document.querySelector(".payments-header-actions")?.getBoundingClientRect();
        return copy && actions ? actions.top - copy.bottom : Number.POSITIVE_INFINITY;
      });
      expect(headerSpacing).toBeGreaterThanOrEqual(0);
      expect(headerSpacing).toBeLessThanOrEqual(40);
    }

    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.html).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
  });
}

test("payment details use keyboard-operable dialog behavior and clear source labels", async ({ page }) => {
  await installFixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/payments", { waitUntil: "domcontentloaded" });
  const viewButton = page.getByRole("button", { name: "View" });
  await viewButton.click();
  const dialog = page.getByRole("dialog", { name: "REEBS-PAY-000012" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Recorded manually")).toBeVisible();
  await expect(dialog.getByText("REEBS Core")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close payment details" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(viewButton).toBeFocused();
});

test("payment register has no automated accessibility violations", async ({ page }) => {
  await installFixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/payments", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("REEBS-PAY-000012")).toBeVisible();
  await injectAxe(page);
  await checkA11y(page, ".payments-page", {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});

test("payment register follows the persisted Faako dark and light themes", async ({ page }) => {
  await installFixtures(page);
  await page.addInitScript(() => {
    localStorage.setItem("reebs_admin_preferences_1", JSON.stringify({
      theme: "dark",
      fontSize: "default",
    }));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/payments", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("data-admin-theme", "dark");

  const darkTheme = await page.evaluate(() => ({
    colorScheme: getComputedStyle(document.body).colorScheme,
    pageColor: getComputedStyle(document.querySelector(".payments-page")).color,
    searchControlCount: document.querySelectorAll(".payments-search input").length,
    inputBackground: getComputedStyle(document.querySelector(".payments-search input")).backgroundColor,
    inputBorder: getComputedStyle(document.querySelector(".payments-search input")).border,
    inputBoxShadow: getComputedStyle(document.querySelector(".payments-search input")).boxShadow,
    resultsBackground: getComputedStyle(document.querySelector(".payments-results")).backgroundColor,
    tableShellBackground: getComputedStyle(document.querySelector(".payments-table-scroll")).backgroundColor,
    tableBackground: getComputedStyle(document.querySelector(".payments-results table")).backgroundColor,
    rowBackground: getComputedStyle(document.querySelector(".payments-results tbody tr")).backgroundColor,
    cellBackground: getComputedStyle(document.querySelector(".payments-results tbody td")).backgroundColor,
    cellColor: getComputedStyle(document.querySelector(".payments-results tbody td")).color,
  }));
  expect(darkTheme.colorScheme).toBe("dark");
  expect(darkTheme.searchControlCount).toBe(1);
  expect(darkTheme.inputBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(darkTheme.inputBorder).not.toContain("0px none");
  expect(darkTheme.inputBoxShadow).toBe("none");
  expect(darkTheme.resultsBackground).toContain("15, 23, 42");
  expect(darkTheme.tableShellBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkTheme.tableBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkTheme.rowBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkTheme.cellBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkTheme.cellColor).toBe("rgb(229, 231, 235)");

  const viewButton = page.getByRole("button", { name: "View" });
  await viewButton.click();
  const darkDialog = await page.evaluate(() => ({
    color: getComputedStyle(document.querySelector(".payments-dialog")).color,
    detailSurface: getComputedStyle(document.querySelector(".payments-detail-list div")).backgroundColor,
  }));
  await page.getByRole("button", { name: "Close payment details" }).click();

  await page.locator(".portal-sidebar__user-button").click();
  await page.getByRole("button", { name: "Light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-admin-theme", "light");

  const lightTheme = await page.evaluate(() => ({
    colorScheme: getComputedStyle(document.body).colorScheme,
    pageColor: getComputedStyle(document.querySelector(".payments-page")).color,
    inputBackground: getComputedStyle(document.querySelector(".payments-search input")).backgroundColor,
    resultsBackground: getComputedStyle(document.querySelector(".payments-results")).backgroundColor,
  }));
  expect(lightTheme.colorScheme).toBe("light");
  expect(lightTheme.pageColor).not.toBe(darkTheme.pageColor);
  expect(lightTheme.inputBackground).not.toBe(darkTheme.inputBackground);
  expect(lightTheme.resultsBackground).not.toBe(darkTheme.resultsBackground);

  await viewButton.click();
  const lightDialog = await page.evaluate(() => ({
    color: getComputedStyle(document.querySelector(".payments-dialog")).color,
    detailSurface: getComputedStyle(document.querySelector(".payments-detail-list div")).backgroundColor,
  }));
  expect(lightDialog.color).not.toBe(darkDialog.color);
  expect(lightDialog.detailSurface).not.toBe(darkDialog.detailSurface);
  await page.getByRole("button", { name: "Close payment details" }).click();

  await injectAxe(page);
  await checkA11y(page, ".payments-page", {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});
