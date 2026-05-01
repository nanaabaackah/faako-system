import { defineErpShellConfig } from "@faako/config";

const sidebarItems = [
  { id: "dashboard", defaultLabel: "Dashboard", path: "/", iconKey: "DB" },
  { id: "orders", defaultLabel: "Orders", path: "/orders", iconKey: "OR" },
  { id: "inventory", defaultLabel: "Inventory", path: "/inventory", iconKey: "IN" },
  { id: "bookings", defaultLabel: "Bookings", path: "/bookings", iconKey: "BK" },
  { id: "vendors", defaultLabel: "Vendors", path: "/vendors", iconKey: "VN" },
  { id: "expenses", defaultLabel: "Expenses", path: "/expenses", iconKey: "EX" },
  { id: "finance", defaultLabel: "Finance", path: "/finance", iconKey: "FN" },
  { id: "reports", defaultLabel: "Reports", path: "/reports", iconKey: "RP" },
  { id: "people", defaultLabel: "People", path: "/people", iconKey: "PP" },
  { id: "customers", defaultLabel: "Customers", path: "/customers", iconKey: "CU" },
  { id: "notifications", defaultLabel: "Alerts", path: "/notifications", iconKey: "AL" },
  { id: "modules", defaultLabel: "Modules", path: "/modules", iconKey: "MD" },
  { id: "settings", defaultLabel: "Settings", path: "/settings", iconKey: "ST" },
];

const bottomNavItems = [
  { id: "dashboard", defaultLabel: "Home", path: "/", iconKey: "HM" },
  { id: "orders", defaultLabel: "Orders", path: "/orders", iconKey: "OR" },
  { id: "inventory", defaultLabel: "Stock", path: "/inventory", iconKey: "ST" },
  { id: "customers", defaultLabel: "CRM", path: "/customers", iconKey: "CR" },
  { id: "settings", defaultLabel: "Settings", path: "/settings", iconKey: "SE" },
];

const applyLabels = (items, overrides = {}) =>
  items.map(({ defaultLabel, ...item }) => ({
    ...item,
    label: overrides[item.id] || defaultLabel,
  }));

const buildPageTitles = (items) => {
  const titles = {};
  items.forEach((item) => {
    titles[item.path] = item.label;
  });
  return titles;
};

export const getErpShellConfig = (scenario) => {
  const navigation = scenario?.navigation || {};
  const resolvedSidebarItems = applyLabels(sidebarItems, navigation.labels);
  const resolvedBottomNavItems = applyLabels(bottomNavItems, navigation.bottomLabels);

  return defineErpShellConfig({
    brand: scenario.brand,
    sidebarItems: resolvedSidebarItems,
    bottomNavItems: resolvedBottomNavItems,
    pageTitles: buildPageTitles(resolvedSidebarItems),
  });
};
