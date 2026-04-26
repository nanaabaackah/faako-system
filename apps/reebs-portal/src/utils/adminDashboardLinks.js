import {
  faBoxesStacked,
  faCalendarDays,
  faChartLine,
  faCloudArrowUp,
  faFileInvoiceDollar,
  faMoneyCheckDollar,
  faReceipt,
  faStore,
  faTruck,
  faUserGroup,
  faUserPlus,
  faUsers,
  faUser,
} from "/src/icons/iconSet";
import { canAccessPortalRoute } from "./adminAccess";

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
  profile: "/admin/profile",
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
      key: "profile",
      label: "My profile",
      description: "Update your account details and sign-in preferences.",
      icon: faUser,
      path: DASHBOARD_PATHS.profile,
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
      key: "profile",
      label: "My profile",
      description: "Review your account and preferences.",
      icon: faUser,
      path: DASHBOARD_PATHS.profile,
    },
  ],
};

const DRIVER_ACTION_SET = {
  badge: "Delivery Flow",
  steps: [
    {
      key: "bookings",
      label: "Upcoming bookings",
      description: "Open the bookings board with the next 7 days in view.",
      icon: faCalendarDays,
      path: DASHBOARD_PATHS.bookingsConfirmed,
    },
    {
      key: "delivery",
      label: "Delivery board",
      description: "Jump into handoffs, routes, and stop updates.",
      icon: faTruck,
      path: "/admin/delivery",
    },
    {
      key: "customers",
      label: "Customer directory",
      description: "Delivery contacts and account details in one view.",
      icon: faUserGroup,
      path: DASHBOARD_PATHS.customerDirectory,
    },
  ],
  shortcuts: [
    {
      key: "delivery",
      label: "Delivery board",
      description: "Update route groups, ETAs, and stop status.",
      icon: faTruck,
      path: "/admin/delivery",
    },
    {
      key: "bookings",
      label: "Bookings",
      description: "See the upcoming delivery queue.",
      icon: faCalendarDays,
      path: "/admin/bookings",
    },
    {
      key: "customers",
      label: "Customers",
      description: "Open customer contact records for delivery follow-ups.",
      icon: faUserGroup,
      path: DASHBOARD_PATHS.customerDirectory,
    },
    {
      key: "profile",
      label: "My profile",
      description: "Review your account and session details.",
      icon: faUser,
      path: DASHBOARD_PATHS.profile,
    },
  ],
};

export const getDashboardActionSet = (role) => {
  const normalizedRole = normalizeAdminRole(role);
  const selectedSet =
    normalizedRole === "admin" || normalizedRole === "manager"
      ? ADMIN_MANAGER_ACTION_SET
      : normalizedRole === "driver"
        ? DRIVER_ACTION_SET
      : normalizedRole === "water"
        ? WATER_ACTION_SET
        : STAFF_ACTION_SET;

  return {
    ...selectedSet,
    steps: selectedSet.steps.filter((item) => canAccessPortalRoute(normalizedRole, item.path)),
    shortcuts: selectedSet.shortcuts.filter((item) => canAccessPortalRoute(normalizedRole, item.path)),
  };
};
