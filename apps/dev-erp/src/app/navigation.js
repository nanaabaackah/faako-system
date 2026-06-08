import {
  Category,
  WalletMoney,
  ReceiptItem,
  CalendarTick,
  Buildings2,
  Monitor,
  DocumentText,
  ClipboardTick,
  Profile2User,
  Setting2,
  Home2,
} from "iconsax-react";
import {
  getModuleBadges,
  getModuleByKey,
  getModuleState,
  getModuleStatusLabel,
  getModuleVisibility,
  getVisibleModules,
  isModuleEnabled,
  isModuleVisible,
} from "@faako/config";
import { DEV_ERP_ADMIN_MODULES } from "../config/adminModules.js";
import { hasModuleAccess, isRentOnlyUser } from "../utils/moduleAccess.js";
import { getAggregateSiteStatus } from "../utils/siteStatus.js";

const NAV_ITEM_ORDER = [
  "dashboard",
  "proposals",
  "rent",
  "accounting",
  "invoicing",
  "bookings",
  "customers",
  "system-health",
  "reports",
  "audit-logs",
  "users",
  "profile",
  "settings",
];

const ICONS_BY_MODULE_KEY = {
  accounting: WalletMoney,
  "audit-logs": ClipboardTick,
  bookings: CalendarTick,
  customers: Buildings2,
  dashboard: Category,
  proposals: DocumentText,
  invoicing: ReceiptItem,
  profile: Profile2User,
  rent: WalletMoney,
  reports: DocumentText,
  settings: Setting2,
  "system-health": Monitor,
  users: Profile2User,
};

const toNavigationItem = (module, overrides = {}) => ({
  key: module.key,
  group: module.group,
  status: module.status,
  state: getModuleState(module),
  visibility: getModuleVisibility(module),
  statusLabel: getModuleStatusLabel(module),
  badges: getModuleBadges(module),
  enabled: isModuleEnabled(module),
  core: Boolean(module.core),
  to: module.path,
  label: module.navLabel || module.label,
  Icon: ICONS_BY_MODULE_KEY[module.key] || Category,
  module: module.requiredPermission || module.key,
  ...overrides,
});

const sortByNavigationOrder = (items = []) =>
  [...items].sort((left, right) => {
    const leftIndex = NAV_ITEM_ORDER.indexOf(left.key);
    const rightIndex = NAV_ITEM_ORDER.indexOf(right.key);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeft - normalizedRight;
  });

const NAV_ITEMS = sortByNavigationOrder(
  getVisibleModules(DEV_ERP_ADMIN_MODULES).map((module) => toNavigationItem(module))
);

const buildRegistryNavItem = (moduleKey, overrides = {}) => {
  const module = getModuleByKey(DEV_ERP_ADMIN_MODULES, moduleKey);
  return module && isModuleVisible(module) ? toNavigationItem(module, overrides) : null;
};

const MOBILE_TAB_ITEMS = [
  buildRegistryNavItem("dashboard", { label: "Home", Icon: Home2 }),
  buildRegistryNavItem("accounting", { label: "Finance", Icon: WalletMoney }),
  buildRegistryNavItem("users", { label: "User Control", Icon: Profile2User }),
  buildRegistryNavItem("bookings", { label: "Appointments", Icon: CalendarTick }),
  buildRegistryNavItem("settings", { label: "Settings", Icon: Setting2 }),
].filter(Boolean);

const RENT_ONLY_NAV_ITEMS = [
  buildRegistryNavItem("dashboard", { label: "Rent", Icon: WalletMoney }),
  buildRegistryNavItem("profile", { label: "Profile", Icon: Profile2User }),
].filter(Boolean);

const RENT_ONLY_MOBILE_TAB_ITEMS = [
  buildRegistryNavItem("dashboard", { label: "Rent", Icon: WalletMoney }),
  buildRegistryNavItem("profile", { label: "Profile", Icon: Profile2User }),
].filter(Boolean);

const isHealthyStatus = (status) => status === "ok" || status === "online";

export const getAlertNotificationCount = (dashboardPayload) => {
  const systemStatus = dashboardPayload?.status ?? {};
  const apiSurfaceStatuses = Array.isArray(dashboardPayload?.apiSurfaces)
    ? dashboardPayload.apiSurfaces.map((surface) => surface?.status)
    : [systemStatus.api, systemStatus.faakoApi, systemStatus.stroaneApi];
  const systemEntries = [
    ...apiSurfaceStatuses,
    systemStatus.portfolioDb,
    systemStatus.reebsDb,
    systemStatus.faakoDb,
    systemStatus.stroaneDb,
  ];
  const systemAlerts = systemEntries.filter((status) => status && !isHealthyStatus(status)).length;

  const siteStatuses = Array.isArray(dashboardPayload?.siteStatus?.sites)
    ? dashboardPayload.siteStatus.sites
    : [];
  const siteAlerts = siteStatuses.filter((site) => {
    const aggregateStatus = getAggregateSiteStatus(site?.pages ?? []);
    return aggregateStatus === "offline" || aggregateStatus === "degraded";
  }).length;

  return systemAlerts + siteAlerts;
};

export const getAppointmentsNotificationCount = (bookingsPayload) => {
  if (!Array.isArray(bookingsPayload)) return 0;
  return bookingsPayload.filter((booking) => String(booking?.status || "").toUpperCase() !== "CANCELED").length;
};

export const getOverdueInvoicesCount = (invoicesPayload) => {
  if (Array.isArray(invoicesPayload?.invoices)) {
    return invoicesPayload.invoices.length;
  }
  return 0;
};

export const getOverdueAccountingCount = (accountingPayload) => {
  const entries = Array.isArray(accountingPayload?.entries) ? accountingPayload.entries : [];
  return entries.filter((entry) => String(entry?.status || "").toUpperCase() === "OVERDUE").length;
};

export const getRentOutstandingCount = (rentPayload) => {
  const tenants = Array.isArray(rentPayload?.tenants) ? rentPayload.tenants : [];
  return tenants.filter((tenant) => Number(tenant?.outstandingTotal || 0) > 0).length;
};

export const formatNotificationCount = (count) => (count > 99 ? "99+" : String(count));

export const getVisibleNavItems = (user) => {
  if (isRentOnlyUser(user)) {
    return RENT_ONLY_NAV_ITEMS;
  }
  return NAV_ITEMS.filter((item) => !item.module || hasModuleAccess(user, item.module));
};

export const getVisibleMobileTabItems = (user) => {
  if (isRentOnlyUser(user)) {
    return RENT_ONLY_MOBILE_TAB_ITEMS;
  }
  return MOBILE_TAB_ITEMS.filter((item) => !item.module || hasModuleAccess(user, item.module));
};

export const getTopbarLabel = (pathname) => {
  if (pathname.startsWith("/book")) return "Appointment";
  if (pathname.startsWith("/proposals")) return "Proposals";
  switch (pathname) {
    case "/dashboard":
      return "Dashboard";
    case "/accounting":
      return "Accounting";
    case "/rent":
      return "Rent";
    case "/bookings":
      return "Appointments";
    case "/proposals":
      return "Proposals";
    case "/invoicing":
      return "Invoicing";
    case "/organizations":
      return "Organizations";
    case "/profile":
      return "Profile";
    case "/system-health":
      return "System Health";
    case "/reports":
      return "Reports";
    case "/audit-logs":
      return "Audit Logs";
    case "/user-control":
      return "User Control";
    case "/settings":
      return "Settings";
    default:
      return "Workspace";
  }
};

export const getTitleForPath = (pathname) => {
  if (pathname.startsWith("/book")) return "Appointment | Dev";
  if (pathname.startsWith("/proposals")) return "Proposals | Dev";
  switch (pathname) {
    case "/":
    case "/dashboard":
      return "Dashboard | Dev";
    case "/login":
      return "Login | Dev";
    case "/setup-account":
      return "Set Up Account | Dev";
    case "/error":
      return "Error | Dev";
    case "/bookings":
      return "Appointments | Dev";
    case "/organizations":
      return "Organizations | Dev";
    case "/profile":
      return "Profile | Dev";
    case "/system-health":
      return "System Health | Dev";
    case "/reports":
      return "Reports | Dev";
    case "/accounting":
      return "Accounting | Dev";
    case "/rent":
      return "Rent | Dev";
    case "/proposals":
      return "Proposals | Dev";
    case "/invoicing":
      return "Invoicing | Dev";
    case "/settings":
      return "Settings | Dev";
    case "/audit-logs":
      return "Audit Logs | Dev";
    case "/user-control":
      return "User Control | Dev";
    default:
      return "Page Not Found | Dev";
  }
};
