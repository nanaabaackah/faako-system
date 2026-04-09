import { defineErpShellConfig } from "@faako/config";

const sidebarItems = [
  { id: "dashboard", label: "Dashboard", path: "/", iconKey: "DB" },
  { id: "orders", label: "Orders", path: "/orders", iconKey: "OR" },
  { id: "inventory", label: "Inventory", path: "/inventory", iconKey: "IN" },
  { id: "bookings", label: "Bookings", path: "/bookings", iconKey: "BK" },
  { id: "vendors", label: "Vendors", path: "/vendors", iconKey: "VN" },
  { id: "expenses", label: "Expenses", path: "/expenses", iconKey: "EX" },
  { id: "finance", label: "Finance", path: "/finance", iconKey: "FN" },
  { id: "reports", label: "Reports", path: "/reports", iconKey: "RP" },
  { id: "people", label: "People", path: "/people", iconKey: "PP" },
  { id: "customers", label: "Customers", path: "/customers", iconKey: "CU" },
  { id: "notifications", label: "Alerts", path: "/notifications", iconKey: "AL" },
  { id: "modules", label: "Modules", path: "/modules", iconKey: "MD" },
  { id: "settings", label: "Settings", path: "/settings", iconKey: "ST" },
];

const bottomNavItems = [
  { id: "dashboard", label: "Home", path: "/", iconKey: "HM" },
  { id: "orders", label: "Orders", path: "/orders", iconKey: "OR" },
  { id: "inventory", label: "Stock", path: "/inventory", iconKey: "ST" },
  { id: "customers", label: "CRM", path: "/customers", iconKey: "CR" },
  { id: "settings", label: "Settings", path: "/settings", iconKey: "SE" },
];

export default defineErpShellConfig({
  brand: {
    name: "Faako ERP",
    shortName: "FAAKO",
    sidebarTitle: "Faako Operations",
    homePath: "/",
    topbarLabel: "Workspace overview",
    shellVars: {
      "--erp-accent": "var(--accent)",
      "--erp-bg": "var(--surface)",
      "--erp-panel": "var(--card)",
      "--erp-panel-strong": "var(--card)",
      "--erp-border": "var(--border)",
      "--erp-ink": "var(--ink)",
      "--erp-muted": "var(--muted)",
    },
  },
  sidebarItems,
  bottomNavItems,
  pageTitles: {
    "/": "Dashboard",
    "/orders": "Orders",
    "/inventory": "Inventory",
    "/bookings": "Bookings",
    "/vendors": "Vendors",
    "/expenses": "Expenses",
    "/finance": "Finance",
    "/reports": "Reports",
    "/people": "People",
    "/customers": "Customers",
    "/notifications": "Notifications",
    "/modules": "Modules",
    "/settings": "Settings",
  },
});
