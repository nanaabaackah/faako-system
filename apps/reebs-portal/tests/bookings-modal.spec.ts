import { expect, test, type Page } from "@playwright/test";

const adminUser = {
  id: 1,
  organizationId: 1,
  firstName: "Admin",
  lastName: "User",
  fullName: "Admin User",
  role: "admin",
  email: "admin@reebs.test",
};

const customer = {
  id: 21,
  organizationId: 1,
  name: "Ama Mensah",
  email: "ama@example.com",
  phone: "+233244123456",
};

const product = {
  id: 101,
  organizationId: 1,
  name: "Mini Bouncy Castle",
  sku: "RNT-101",
  sourceCategoryCode: "RENTAL",
  specificCategory: "Bouncy Castles",
  price: 700,
  quantity: 2,
  status: true,
  imageUrl: "/imgs/placeholder.png",
  variants: [],
};

const booking = {
  id: 31,
  reference: "RB-2026-000031",
  customerId: customer.id,
  customerName: customer.name,
  customerEmail: customer.email,
  customerPhone: customer.phone,
  eventDate: "2026-09-12",
  eventEndDate: "2026-09-13",
  startTime: "10:00 AM",
  endTime: "04:00 PM",
  venueAddress: "East Legon, Accra",
  venueGhanaPostGps: "GA-184-8164",
  currency: "GHS",
  subtotalCents: 70000,
  discountCents: 0,
  feeCents: 10000,
  taxCents: 0,
  depositRateBps: 7000,
  depositRequiredCents: 56000,
  totalAmount: 80000,
  status: "pending",
  assignedUserId: adminUser.id,
  assignedUserName: adminUser.fullName,
  createdAt: "2026-08-29T12:00:00.000Z",
  updatedAt: "2026-08-29T12:00:00.000Z",
  items: [
    {
      id: 41,
      productId: product.id,
      quantity: 1,
      price: 70000,
      catalogPrice: 70000,
      lineTotal: 70000,
      productName: product.name,
      productImage: product.imageUrl,
    },
  ],
};

const installBookingApi = async (page: Page) => {
  const expenses: Array<Record<string, unknown>> = [];
  const invoiceExpenseReads: number[][] = [];

  await page.addInitScript((user) => {
    localStorage.setItem("reebs_auth_user", JSON.stringify(user));
  }, adminUser);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.split("/").pop() || "";
    let payload: unknown = [];

    if (endpoint === "authSession") payload = adminUser;
    else if (endpoint === "bookings") payload = url.searchParams.get("id") ? booking : [booking];
    else if (endpoint === "inventory") payload = [product];
    else if (endpoint === "customers") payload = [customer];
    else if (endpoint === "users") payload = [adminUser];
    else if (endpoint === "expenses") {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        const expense = {
          id: 501,
          organizationId: 1,
          bookingId: booking.id,
          category: "Logistics",
          description: body.description,
          amount: Math.round(Number(body.amount) * 100),
          date: body.date,
        };
        expenses.unshift(expense);
        payload = expense;
      } else {
        payload = expenses;
      }
    } else if (endpoint === "getInvoiceDetails") {
      invoiceExpenseReads.push(expenses.map((expense) => Number(expense.id)));
      payload = {
        ...booking,
        expenses: expenses.map((expense) => ({
          ...expense,
          amount: Number(expense.amount) / 100,
        })),
        expensesTotal: expenses.reduce((sum, expense) => sum + Number(expense.amount), 0) / 100,
      };
    } else if (endpoint === "invoice-documents" || endpoint === "deliveries" || endpoint === "documents") {
      payload = [];
    } else if (endpoint === "bouncy_castles") {
      payload = [];
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  return { expenses, invoiceExpenseReads };
};

const openBookingDetail = async (page: Page) => {
  await page.goto("/admin/bookings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible({ timeout: 60_000 });
  await page.getByText(booking.reference).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
};

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`booking detail modal contains its controls without horizontal overlap on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installBookingApi(page);
    const dialog = await openBookingDetail(page);

    const layout = await dialog.evaluate((node) => {
      const panel = node.querySelector(".bookings-detail-panel");
      if (!(panel instanceof HTMLElement)) return null;
      const bounds = panel.getBoundingClientRect();
      const offenders = Array.from(
        panel.querySelectorAll("input, textarea, select, button, .search-field")
      ).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
      });
      const overflowing = Array.from(panel.querySelectorAll("*"))
        .filter((element) => element instanceof HTMLElement && element.scrollWidth > element.clientWidth + 1)
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          className: element.className,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }));
      return {
        panelClientWidth: panel.clientWidth,
        panelScrollWidth: panel.scrollWidth,
        offenderCount: offenders.length,
        overflowing,
      };
    });

    expect(layout).not.toBeNull();
    expect(
      layout?.panelScrollWidth,
      `Overflow diagnostics: ${JSON.stringify(layout?.overflowing)}`
    ).toBeLessThanOrEqual((layout?.panelClientWidth || 0) + 1);
    expect(layout?.offenderCount).toBe(0);
  });
}

test("a booking expense is linked immediately and included in the invoice refresh", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = await installBookingApi(page);
  const dialog = await openBookingDetail(page);

  await dialog.getByLabel("Search or add expense").fill("Fuel for delivery");
  await dialog.getByLabel("Amount").fill("125");
  await expect(dialog.getByLabel("Date")).toContainText(/12\/09\/2026|12 Sept? 2026/i);
  await dialog.getByRole("button", { name: "Add expense" }).click();

  await expect(dialog.getByText("Expense added")).toBeVisible();
  await expect(dialog.getByText("Fuel for delivery")).toBeVisible();
  expect(state.expenses).toHaveLength(1);

  await dialog.getByRole("button", { name: "Open invoice" }).click();
  await expect(page).toHaveURL(/\/admin\/invoicing\?type=bookings&id=31/);
  await expect.poll(() => state.invoiceExpenseReads.length).toBeGreaterThan(0);
  expect(state.invoiceExpenseReads.at(-1)).toContain(501);
});
