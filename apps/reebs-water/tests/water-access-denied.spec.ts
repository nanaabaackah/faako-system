import { expect, test } from "@playwright/test";

test("an authenticated user without backend Water permission sees the 403 state", async ({ page }) => {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/auth/session")) {
      return route.fulfill({
        json: { id: 50, name: "Restricted user", role: "staff", email: "staff@reebs.test" },
      });
    }
    if (pathname === "/api/water") {
      return route.fulfill({ status: 403, json: { error: "Insufficient privileges." } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "403 · Access denied" })).toBeVisible();
  await expect(page.getByText("Your account is authenticated, but it does not have permission to access this business.")).toBeVisible();
});
