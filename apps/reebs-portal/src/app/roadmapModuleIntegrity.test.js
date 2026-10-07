import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readPortalSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const modules = {
  bookings: {
    page: readPortalSource("../pages/AdminBookings/AdminBookings.jsx"),
    styles: readPortalSource("../pages/AdminBookings/AdminBookings.css"),
  },
  rentals: {
    page: readPortalSource("../pages/AdminRentals/AdminRentals.jsx"),
    styles: readPortalSource("../pages/AdminRentals/AdminRentals.css"),
  },
  orders: {
    page: readPortalSource("../pages/OrdersList/OrdersList.jsx"),
    styles: readPortalSource("../pages/OrdersList/OrdersList.css"),
  },
  dashboard: {
    page: readPortalSource("../pages/AdminDashboard/AdminDashboard.jsx"),
    styles: readPortalSource("../pages/AdminDashboard/AdminDashboard.css"),
  },
  inventory: {
    page: readPortalSource("../pages/Admin/Admin.jsx"),
    styles: [
      readPortalSource("../pages/Admin/Admin.css"),
      readPortalSource("../pages/Admin/styles/AdminInventoryRegister.css"),
      readPortalSource("../pages/Admin/styles/AdminInventoryResponsive.css"),
    ].join("\n"),
  },
  customers: {
    page: readPortalSource("../pages/AdminCustomers/AdminCustomers.jsx"),
    styles: readPortalSource("../pages/AdminCustomers/AdminCustomers.css"),
  },
  payments: {
    page: readPortalSource("../pages/AdminPayments/AdminPayments.jsx"),
    styles: readPortalSource("../pages/AdminPayments/AdminPayments.css"),
  },
  invoicing: {
    page: [
      readPortalSource("../pages/AdminInvoicing/AdminInvoicing.jsx"),
      readPortalSource("../pages/AdminInvoicing/components/InvoiceDocumentListSection.jsx"),
    ].join("\n"),
    styles: readPortalSource("../pages/AdminInvoicing/AdminInvoicing.css"),
  },
  water: {
    page: [
      readPortalSource("../pages/AdminWater/AdminWater.jsx"),
      readPortalSource("../pages/AdminWater/components/WaterKpiGrid.jsx"),
      readPortalSource("../pages/AdminWater/components/WaterRestockCard.jsx"),
    ].join("\n"),
    styles: readPortalSource("../pages/AdminWater/AdminWater.css"),
  },
};

test("roadmap registers retain pagination and their compact-screen layouts", () => {
  for (const name of ["bookings", "rentals", "orders", "customers", "payments", "invoicing"]) {
    assert.match(modules[name].page, /TablePagination/, `${name} should retain table pagination`);
  }

  for (const [name, module] of Object.entries(modules)) {
    assert.match(
      module.styles,
      /@media\s*\(max-width:\s*(?:720|620|560|520|420)px\)/,
      `${name} should retain a phone-sized layout`
    );
  }

  assert.match(modules.orders.page, /MOBILE_VIEW_QUERY\s*=\s*"\(max-width:\s*720px\)"/);
  assert.match(modules.inventory.page, /MOBILE_VIEW_QUERY\s*=\s*"\(max-width:\s*720px\)"/);
  assert.match(modules.payments.styles, /\.payments-results td::before\s*{[\s\S]*attr\(data-label\)/);
  assert.match(modules.invoicing.styles, /\.invoice-hub-mobile-list\s*{[\s\S]*display:\s*grid/);
  assert.match(modules.water.styles, /\.water-module-table--orders tbody tr,[\s\S]*display:\s*grid/);
});

test("payments retains the Faako register structure and requested source column", () => {
  assert.match(modules.payments.page, />Type\s*\/\s*source</);
  assert.match(modules.payments.page, /payment\.source\s*===\s*"MANUAL"\s*\?\s*"Manual"\s*:\s*"Provider"/);
  assert.doesNotMatch(modules.payments.page, /<th[^>]*>\s*Scope\s*<\/th>/i);
  assert.match(modules.payments.styles, /var\(--admin-card/);
  assert.match(modules.payments.styles, /\[data-admin-theme="dark"\]/);
});

test("invoicing retains manual-source copy and authoritative paid and balance fields", () => {
  assert.match(modules.invoicing.page, /MANUAL_LINKED_LABEL\s*=\s*"Manual"/);
  assert.doesNotMatch(modules.invoicing.page, /built here/i);
  assert.match(modules.invoicing.page, /amountPaidCents/);
  assert.match(modules.invoicing.page, /balanceDueCents/);
  assert.match(modules.invoicing.page, />Paid<\/span>/);
  assert.match(modules.invoicing.page, />Balance<\/span>/);
  assert.doesNotMatch(modules.invoicing.page, /<th[^>]*>\s*Scope\s*<\/th>/i);
});

test("dashboard and Water retain the standalone business boundary", () => {
  assert.match(modules.dashboard.page, /DashboardCollections/);
  assert.match(modules.dashboard.page, /Needs attention/);
  assert.match(modules.dashboard.page, /DashboardActivity/);
  assert.match(
    modules.dashboard.page,
    /No Water sales, revenue, costs, customers or profit are included above\./
  );
  assert.match(modules.dashboard.page, /bubble-card reebs-dashboard-summary-card/);
  assert.match(modules.dashboard.page, /className="glass-card/);

  assert.match(modules.water.page, /update_restock/);
  assert.match(modules.water.page, /unitCost/);
  assert.match(modules.water.page, /Water revenue/);
  assert.match(modules.water.page, /Water net profit/);
  assert.match(modules.water.page, /Purchase cost per pack \(GHS\)/);
  assert.match(modules.water.page, /aria-label="Purchase cost per pack"/);
  assert.doesNotMatch(modules.water.page, /overrideReason/i);
});

test("roadmap operational links remain represented in the completed modules", () => {
  assert.match(modules.bookings.page, /deliveryByBookingId/);
  assert.match(modules.bookings.page, /documentByBookingId/);
  assert.match(modules.rentals.page, /openMaintenanceCount/);
  assert.match(modules.rentals.page, /invoice-documents/);
  assert.match(modules.orders.page, /fulfillmentStatus/);
  assert.match(modules.orders.page, /Record payment first/);
  assert.match(modules.inventory.page, /scopeFilter/);
  assert.match(modules.customers.page, /beforeunload/);
  assert.match(modules.customers.page, /TablePagination/);
});
