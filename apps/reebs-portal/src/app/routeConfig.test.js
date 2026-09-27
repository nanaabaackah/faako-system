import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("./routeConfig.js", import.meta.url), "utf8");

const roadmapModules = [
  ["bookings", "/admin/bookings", "Bookings", "../modules/bookings/index.js", "AdminBookings/AdminBookings"],
  ["rentals", "/admin/rentals", "Rentals", "../modules/rentals/index.js", "AdminRentals/AdminRentals"],
  ["orders", "/admin/orders", "Orders", "../modules/orders/index.js", "OrdersList/OrdersList"],
  ["customers", "/admin/crm", "Customers", "../modules/customers/index.js", "AdminCustomers/AdminCustomers"],
  ["inventory", "/admin/inventory", "Inventory", "../modules/inventory/index.js", "Admin/Admin"],
  ["invoicing", "/admin/invoicing", "Invoicing", "../modules/invoicing/index.js", "AdminInvoicing/AdminInvoicing"],
];

test("roadmap dashboard and payments modules have reachable portal routes", () => {
  assert.match(
    routeSource,
    /path:\s*"\/admin",\s*domain:\s*"dashboard",\s*component:\s*Dashboard,\s*auth:\s*true,\s*access:\s*"standard"/
  );
  assert.match(
    routeSource,
    /path:\s*"\/admin\/payments",\s*domain:\s*"payments",\s*component:\s*Payments,\s*auth:\s*true,\s*accessPath:\s*"\/admin\/payments"/
  );
});

test("dashboard loader uses the roadmap dashboard without replacing workspace subsections", () => {
  const moduleSource = readFileSync(
    new URL("../modules/dashboard/index.js", import.meta.url),
    "utf8"
  );

  assert.match(moduleSource, /loadDashboardPage[\s\S]*AdminDashboard\/AdminDashboard/);
  assert.match(moduleSource, /loadAdminWorkspacePage[\s\S]*AdminWorkspace\/AdminWorkspace/);
  assert.match(routeSource, /path:\s*"\/admin\/purchases"[\s\S]*component:\s*AdminWorkspace/);
  assert.match(routeSource, /path:\s*"\/admin\/offline"[\s\S]*component:\s*AdminWorkspace/);
});

test("payments loader resolves the completed payment register", () => {
  const moduleSource = readFileSync(
    new URL("../modules/payments/index.js", import.meta.url),
    "utf8"
  );

  assert.match(moduleSource, /AdminPayments\/AdminPayments/);
});

test("all completed roadmap modules remain connected to their portal entry points", () => {
  for (const [domain, path, component, modulePath, pageImport] of roadmapModules) {
    assert.ok(
      routeSource.includes(`path: "${path}", domain: "${domain}", component: ${component}`),
      `${domain} route should use ${component}`
    );
    const moduleSource = readFileSync(new URL(modulePath, import.meta.url), "utf8");
    assert.ok(
      moduleSource.includes(pageImport),
      `${domain} loader should resolve ${pageImport}`
    );
  }
});
