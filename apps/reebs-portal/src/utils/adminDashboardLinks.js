import {
  faBoxesStacked,
  faCalendarDays,
  faChartLine,
  faCloudArrowUp,
  faFileInvoiceDollar,
  faMoneyCheckDollar,
  faReceipt,
  faStore,
  faUserGroup,
  faUserPlus,
  faUsers,
} from "/src/icons/iconSet";

export const normalizeAdminRole = (role) => String(role || "").trim().toLowerCase();

export const DASHBOARD_PATHS = {
  accounting: "/admin/accounting",
  addCustomer: "/admin/directory?tab=customers&action=create",
  bookingsConfirmed: "/admin/bookings?status=confirmed",
  bookingsPending: "/admin/bookings?status=pending",
  customerDirectory: "/admin/directory?tab=customers",
  inventory: "/admin/inventory",
  inventoryActivity: "/admin/inventory?view=activity",
  inventoryLow: "/admin/inventory?stock=low&reorder=1",
  invoicing: "/admin/invoicing",
  newOrder: "/admin/orders/new",
  offline: "/admin/offline",
  orderApprovals: "/admin/orders?status=pending",
  orders: "/admin/orders",
  pos: "/admin/store-mode",
  expenses: "/admin/expenses",
  userDirectory: "/admin/directory?tab=users",
  vendors: "/admin/vendors",
  water: "/admin/water",
};

const ADMIN_MANAGER_ACTION_SET = {
  badge: "Admin Flow",
  steps: [
    {
      key: "orders",
      label: "Pending orders",
      description: "Opens the order ledger already filtered to approvals.",
      icon: faReceipt,
      path: DASHBOARD_PATHS.orderApprovals,
    },
    {
      key: "bookings",
      label: "Pending bookings",
      description: "Opens bookings already filtered to items waiting for action.",
      icon: faCalendarDays,
      path: DASHBOARD_PATHS.bookingsPending,
    },
    {
      key: "customers",
      label: "New customer",
      description: "Opens Customer Directory with the create modal already open.",
      icon: faUserPlus,
      path: DASHBOARD_PATHS.addCustomer,
    },
  ],
  shortcuts: [
    {
      key: "customer-directory",
      label: "Customer directory",
      description: "Contacts, order history, and quick edits.",
      icon: faUserGroup,
      path: DASHBOARD_PATHS.customerDirectory,
    },
    {
      key: "user-directory",
      label: "Team directory",
      description: "Staff accounts and role updates.",
      icon: faUsers,
      path: DASHBOARD_PATHS.userDirectory,
    },
    {
      key: "inventory-low",
      label: "Inventory risk",
      description: "Low-stock items in one filtered view.",
      icon: faBoxesStacked,
      path: DASHBOARD_PATHS.inventoryLow,
    },
    {
      key: "accounting",
      label: "Accounting",
      description: "Revenue, margins, and operating view.",
      icon: faChartLine,
      path: DASHBOARD_PATHS.accounting,
    },
    {
      key: "expenses",
      label: "Expenses",
      description: "Review spend without extra filtering.",
      icon: faMoneyCheckDollar,
      path: DASHBOARD_PATHS.expenses,
    },
    {
      key: "invoicing",
      label: "Invoicing",
      description: "Open invoices and related documents.",
      icon: faFileInvoiceDollar,
      path: DASHBOARD_PATHS.invoicing,
    },
  ],
};

const STAFF_ACTION_SET = {
  badge: "Store Flow",
  steps: [
    {
      key: "pos",
      label: "Store Mode",
      description: "Opens POS directly for walk-in sales.",
      icon: faStore,
      path: DASHBOARD_PATHS.pos,
    },
    {
      key: "orders",
      label: "Create order",
      description: "Opens the full order builder directly.",
      icon: faReceipt,
      path: DASHBOARD_PATHS.newOrder,
    },
    {
      key: "customers",
      label: "New customer",
      description: "Opens Customer Directory with the create modal already open.",
      icon: faUserPlus,
      path: DASHBOARD_PATHS.addCustomer,
    },
  ],
  shortcuts: [
    {
      key: "customers",
      label: "Customer directory",
      description: "Search existing customers and open records.",
      icon: faUserGroup,
      path: DASHBOARD_PATHS.customerDirectory,
    },
    {
      key: "inventory",
      label: "Inventory",
      description: "Open the full stock page.",
      icon: faBoxesStacked,
      path: DASHBOARD_PATHS.inventory,
    },
    {
      key: "inventory-low",
      label: "Low stock",
      description: "Jump into products that need a refill.",
      icon: faBoxesStacked,
      path: DASHBOARD_PATHS.inventoryLow,
    },
    {
      key: "offline",
      label: "Sync queue",
      description: "Retry anything still waiting to sync.",
      icon: faCloudArrowUp,
      path: DASHBOARD_PATHS.offline,
    },
  ],
};

const WATER_ACTION_SET = {
  badge: "Water Flow",
  steps: [
    {
      key: "water",
      label: "Water desk",
      description: "Opens the water module directly.",
      icon: faStore,
      path: DASHBOARD_PATHS.water,
    },
    {
      key: "customers",
      label: "New customer",
      description: "Opens Customer Directory with the create modal already open.",
      icon: faUserPlus,
      path: DASHBOARD_PATHS.addCustomer,
    },
    {
      key: "vendors",
      label: "Vendors",
      description: "Opens the supplier list directly.",
      icon: faUsers,
      path: DASHBOARD_PATHS.vendors,
    },
  ],
  shortcuts: [
    {
      key: "water-dashboard",
      label: "Water module",
      description: "Daily water operations and numbers.",
      icon: faStore,
      path: DASHBOARD_PATHS.water,
    },
    {
      key: "customers",
      label: "Customer directory",
      description: "Search or update water buyers.",
      icon: faUserGroup,
      path: DASHBOARD_PATHS.customerDirectory,
    },
    {
      key: "vendors",
      label: "Vendors",
      description: "Supplier contacts and lead times.",
      icon: faUsers,
      path: DASHBOARD_PATHS.vendors,
    },
    {
      key: "offline",
      label: "Sync queue",
      description: "Check anything waiting to sync.",
      icon: faCloudArrowUp,
      path: DASHBOARD_PATHS.offline,
    },
  ],
};

export const getDashboardActionSet = (role) => {
  const normalizedRole = normalizeAdminRole(role);
  if (normalizedRole === "admin" || normalizedRole === "manager") {
    return ADMIN_MANAGER_ACTION_SET;
  }
  if (normalizedRole === "water") {
    return WATER_ACTION_SET;
  }
  return STAFF_ACTION_SET;
};
