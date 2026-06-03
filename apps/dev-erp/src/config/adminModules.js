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

export const DEV_ERP_ADMIN_MODULES = [
  {
    key: "home",
    label: "Home",
    ...DEFAULT_MODULE_STATE,
    path: "/",
    legacyRoutes: [{ from: "/", to: "/dashboard" }],
    group: ERP_MODULE_GROUPS.CORE,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    includeInNavigation: false,
  },
  {
    key: "dashboard",
    label: "Dashboard",
    ...DEFAULT_MODULE_STATE,
    path: "/dashboard",
    group: ERP_MODULE_GROUPS.CORE,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    requiredPermission: "dashboard",
  },
  {
    key: "proposals",
    label: "Proposals",
    ...DEFAULT_MODULE_STATE,
    path: "/proposals",
    group: ERP_MODULE_GROUPS.SALES,
    status: ERP_MODULE_STATUSES.EXPERIMENTAL,
    core: false,
    requiredPermission: "proposals",
  },
  {
    key: "rent",
    label: "Rent",
    ...DEFAULT_MODULE_STATE,
    path: "/rent",
    group: ERP_MODULE_GROUPS.OPERATIONS,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    requiredPermission: "rent",
    children: [
      {
        key: "bookings",
        label: "Appointments",
        path: "/bookings",
        requiredPermission: "bookings",
      },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    ...DEFAULT_MODULE_STATE,
    navLabel: "Organizations",
    path: "/organizations",
    group: ERP_MODULE_GROUPS.TEAM,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    requiredPermission: "organizations",
  },
  {
    key: "payments",
    label: "Payments",
    ...DEFAULT_MODULE_STATE,
    path: "/accounting",
    matchPaths: ["/invoicing", "/invoice/view/:token"],
    group: ERP_MODULE_GROUPS.FINANCE,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    includeInNavigation: false,
    children: [
      {
        key: "accounting",
        label: "Accounting",
        path: "/accounting",
        requiredPermission: "accounting",
      },
      {
        key: "invoicing",
        label: "Invoicing",
        path: "/invoicing",
        requiredPermission: "invoicing",
      },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    ...DEFAULT_MODULE_STATE,
    path: "/reports",
    group: ERP_MODULE_GROUPS.INSIGHTS,
    status: ERP_MODULE_STATUSES.STABLE,
    requiredPermission: "reports",
  },
  {
    key: "system-health",
    label: "System Health",
    ...DEFAULT_MODULE_STATE,
    path: "/system-health",
    group: ERP_MODULE_GROUPS.INSIGHTS,
    status: ERP_MODULE_STATUSES.STABLE,
    requiredPermission: "system-health",
  },
  {
    key: "audit-logs",
    label: "Audit Logs",
    ...DEFAULT_MODULE_STATE,
    path: "/audit-logs",
    group: ERP_MODULE_GROUPS.INSIGHTS,
    status: ERP_MODULE_STATUSES.STABLE,
    requiredPermission: "audit-logs",
  },
  {
    key: "users",
    label: "Users",
    ...DEFAULT_MODULE_STATE,
    path: "/user-control",
    legacyRoutes: [{ from: "/users", to: "/user-control" }],
    group: ERP_MODULE_GROUPS.TEAM,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    requiredPermission: "user-control",
    children: [
      {
        key: "profile",
        label: "Profile",
        path: "/profile",
        requiredPermission: "profile",
      },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    ...DEFAULT_MODULE_STATE,
    path: "/settings",
    group: ERP_MODULE_GROUPS.SYSTEM,
    status: ERP_MODULE_STATUSES.STABLE,
    core: true,
    requiredPermission: "settings",
  },
];

export const getDevErpAdminModuleByKey = (key) => getModuleByKey(DEV_ERP_ADMIN_MODULES, key);
export const getDevErpAdminModuleByPath = (path) => getModuleByPath(DEV_ERP_ADMIN_MODULES, path);
export const getDevErpAdminModulesByGroup = (group) => getModulesByGroup(DEV_ERP_ADMIN_MODULES, group);
export const getDevErpCoreAdminModules = () => getCoreModules(DEV_ERP_ADMIN_MODULES);
export const getDevErpOptionalAdminModules = () => getOptionalModules(DEV_ERP_ADMIN_MODULES);
export const getDevErpLegacyRouteTarget = (path) => getLegacyRouteTarget(DEV_ERP_ADMIN_MODULES, path);
export const isDevErpCoreAdminModule = isCoreModule;

export default DEV_ERP_ADMIN_MODULES;
