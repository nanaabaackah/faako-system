import {
  ERP_MODULE_GROUPS,
  ERP_MODULE_STATES,
  ERP_MODULE_STATUSES,
  ERP_MODULE_VISIBILITY,
  getCoreModules,
  getLegacyRouteTarget,
  getModuleByKey,
  getModuleByPath,
  getModulesByGroup,
  getOptionalModules,
  isCoreModule,
} from "@faako/config";

const DEFAULT_MODULE_STATE = {
  visibility: ERP_MODULE_VISIBILITY.VISIBLE,
  state: ERP_MODULE_STATES.ENABLED,
};

export const REEBS_ADMIN_MODULES = [
  {
    key: "home",
    label: "Home",
    ...DEFAULT_MODULE_STATE,
    path: "/admin",
    group: ERP_MODULE_GROUPS.CORE,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    children: [
      {
        key: "website",
        label: "Website",
        path: "https://reebspartythemes.com",
        external: true,
        description: "Open the public website",
        requiredPermission: "privileged",
      },
    ],
  },
  {
    key: "pos",
    label: "POS",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/store-mode",
    group: ERP_MODULE_GROUPS.SALES,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    children: [
      {
        key: "purchases",
        label: "Purchases",
        path: "/admin/purchases",
        sidebar: false,
        bottomNav: true,
        requiredPermission: "standard",
      },
    ],
  },
  {
    key: "orders",
    label: "Orders",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/orders",
    matchPaths: ["/admin/orders/new", "/admin/orders/:id"],
    group: ERP_MODULE_GROUPS.SALES,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
  },
  {
    key: "bookings",
    label: "Bookings",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/bookings",
    matchPaths: ["/admin/schedule", "/admin/rentals"],
    group: ERP_MODULE_GROUPS.OPERATIONS,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    // TODO: Replace route-only grouping with a deeper Bookings workspace
    // after shared booking calendar, linked order/payment flow, rental return
    // workflow, and delivery/setup schedule behavior are reviewed separately.
    children: [
      {
        key: "schedule",
        label: "Scheduling",
        path: "/admin/schedule",
        requiredPermission: "privileged",
        sidebar: false,
      },
      {
        key: "rentals",
        label: "Rentals",
        path: "/admin/rentals",
        requiredPermission: "standard",
        sidebar: false,
      },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/inventory",
    group: ERP_MODULE_GROUPS.OPERATIONS,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    children: [
      {
        key: "maintenance",
        label: "Maintenance",
        path: "/admin/maintenance",
        requiredPermission: "standard",
      },
      {
        key: "water",
        label: "Water",
        path: "/admin/water",
        requiredPermission: "water",
      },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    ...DEFAULT_MODULE_STATE,
    navLabel: "CRM",
    path: "/admin/crm",
    legacyRoutes: [{ from: "/admin/customers", to: "/admin/crm" }],
    group: ERP_MODULE_GROUPS.TEAM,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
  },
  {
    key: "delivery",
    label: "Delivery",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/delivery",
    group: ERP_MODULE_GROUPS.OPERATIONS,
    status: ERP_MODULE_STATUSES.STABLE,
  },
  {
    key: "finance",
    label: "Finance",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/accounting",
    matchPaths: ["/admin/expenses", "/admin/invoicing", "/admin/documents", "/admin/vendors"],
    group: ERP_MODULE_GROUPS.FINANCE,
    status: ERP_MODULE_STATUSES.STABLE,
    requiredPermission: "privileged",
    // TODO: Replace route-only Finance grouping with a deeper Finance workspace
    // only after order payments, receipts, invoice documents, POS/order balance
    // behavior, and accounting/report dependencies are reviewed separately.
    children: [
      {
        key: "accounting",
        label: "Accounting",
        path: "/admin/accounting",
        requiredPermission: "privileged",
        sidebar: false,
      },
      {
        key: "invoicing",
        label: "Invoicing",
        path: "/admin/invoicing",
        requiredPermission: "privileged",
        sidebar: false,
      },
      {
        key: "expenses",
        label: "Expenses",
        path: "/admin/expenses",
        requiredPermission: "privileged",
        sidebar: false,
      },
      {
        key: "vendors",
        label: "Vendors",
        path: "/admin/vendors",
        requiredPermission: "privileged",
      },
      {
        key: "documents",
        label: "Documents",
        path: "/admin/documents",
        requiredPermission: "privileged",
      },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/reports",
    matchPaths: ["/admin/audit-logs"],
    group: ERP_MODULE_GROUPS.INSIGHTS,
    status: ERP_MODULE_STATUSES.STABLE,
    children: [
      {
        key: "audit-log",
        label: "Audit Log",
        path: "/admin/audit-logs",
        requiredPermission: "ownerAdmin",
      },
    ],
  },
  {
    key: "team",
    label: "Team",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/directory",
    matchPaths: ["/admin/users", "/admin/employees", "/admin/hr", "/admin/roles", "/admin/timesheets"],
    group: ERP_MODULE_GROUPS.TEAM,
    status: ERP_MODULE_STATUSES.STABLE,
    requiredPermission: "standard",
    // TODO: Replace matched legacy team routes with a deeper Team workspace
    // only after route ownership, role behavior, and admin workflows are reviewed.
    children: [
      {
        key: "directory",
        label: "Directory",
        path: "/admin/directory",
        matchPaths: ["/admin/users", "/admin/employees"],
        requiredPermission: "standard",
        sidebar: false,
      },
      {
        key: "hr",
        label: "Human Resources",
        path: "/admin/hr",
        requiredPermission: "privileged",
        sidebar: false,
      },
      {
        key: "timesheets",
        label: "Timesheets",
        path: "/admin/timesheets",
        requiredPermission: "standard",
        sidebar: false,
      },
      {
        key: "roles",
        label: "Users",
        path: "/admin/roles",
        requiredPermission: "privileged",
        sidebar: false,
      },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    ...DEFAULT_MODULE_STATE,
    path: "/admin/settings",
    matchPaths: [
      "/admin/advanced",
      "/admin/website-template",
      "/admin/inventory/products",
      "/admin/inventory/templates",
    ],
    legacyRoutes: [
      { from: "/admin/advanced", to: "/admin/settings?tab=advanced" },
      { from: "/admin/website-template", to: "/admin/settings?tab=advanced" },
    ],
    group: ERP_MODULE_GROUPS.SYSTEM,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    // TODO: Connect module enable/disable settings here after backend-owned
    // module config, permissions integration, and org-level controls exist.
    children: [
      {
        key: "advanced-settings",
        label: "Advanced",
        path: "/admin/advanced",
        requiredPermission: "privileged",
        sidebar: false,
      },
      {
        key: "website-template",
        label: "Website Template",
        path: "/admin/website-template",
        requiredPermission: "privileged",
        sidebar: false,
      },
      {
        key: "inventory-products",
        label: "Inventory Products",
        path: "/admin/inventory/products",
        requiredPermission: "ownerAdmin",
        sidebar: false,
      },
      {
        key: "inventory-templates",
        label: "Inventory Templates",
        path: "/admin/inventory/templates",
        requiredPermission: "ownerAdmin",
        sidebar: false,
      },
      {
        key: "marketing",
        label: "Marketing",
        path: "/admin/marketing",
        requiredPermission: "privileged",
      },
    ],
  },
];

export const getReebsAdminModuleByKey = (key) => getModuleByKey(REEBS_ADMIN_MODULES, key);
export const getReebsAdminModuleByPath = (path) => getModuleByPath(REEBS_ADMIN_MODULES, path);
export const getReebsAdminModulesByGroup = (group) => getModulesByGroup(REEBS_ADMIN_MODULES, group);
export const getReebsCoreAdminModules = () => getCoreModules(REEBS_ADMIN_MODULES);
export const getReebsOptionalAdminModules = () => getOptionalModules(REEBS_ADMIN_MODULES);
export const getReebsLegacyRouteTarget = (path) => getLegacyRouteTarget(REEBS_ADMIN_MODULES, path);
export const isReebsCoreAdminModule = isCoreModule;

export default REEBS_ADMIN_MODULES;
