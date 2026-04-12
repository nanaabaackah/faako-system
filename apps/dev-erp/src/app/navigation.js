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
import { hasModuleAccess, isRentOnlyUser } from "../utils/moduleAccess";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: Category, module: "dashboard" },
  { to: "/rent", label: "Rent", Icon: WalletMoney, module: "rent" },
  { to: "/accounting", label: "Accounting", Icon: WalletMoney, module: "accounting" },
  { to: "/invoicing", label: "Invoicing", Icon: ReceiptItem, module: "invoicing" },
  { to: "/bookings", label: "Appointments", Icon: CalendarTick, module: "bookings" },
  { to: "/organizations", label: "Organizations", Icon: Buildings2, module: "organizations" },
  { to: "/system-health", label: "System Health", Icon: Monitor, module: "system-health" },
  { to: "/reports", label: "Reports", Icon: DocumentText, module: "reports" },
  { to: "/audit-logs", label: "Audit Logs", Icon: ClipboardTick, module: "audit-logs" },
  { to: "/user-control", label: "User Control", Icon: Profile2User, module: "user-control" },
  { to: "/profile", label: "Profile", Icon: Profile2User, module: "profile" },
  { to: "/settings", label: "Settings", Icon: Setting2, module: "settings" },
];

const MOBILE_TAB_ITEMS = [
  { to: "/dashboard", label: "Home", Icon: Home2, module: "dashboard" },
  { to: "/accounting", label: "Finance", Icon: WalletMoney, module: "accounting" },
  { to: "/user-control", label: "User Control", Icon: Profile2User, module: "user-control" },
  { to: "/bookings", label: "Appointments", Icon: CalendarTick, module: "bookings" },
  { to: "/settings", label: "Settings", Icon: Setting2, module: "settings" },
];

const RENT_ONLY_NAV_ITEMS = [
  { to: "/dashboard", label: "Rent", Icon: WalletMoney },
  { to: "/profile", label: "Profile", Icon: Profile2User },
];

const RENT_ONLY_MOBILE_TAB_ITEMS = [
  { to: "/dashboard", label: "Rent", Icon: WalletMoney },
  { to: "/profile", label: "Profile", Icon: Profile2User },
];

const isHealthyStatus = (status) => status === "ok" || status === "online";

const getSiteAggregateStatus = (pages = []) => {
  if (!Array.isArray(pages) || !pages.length) return "unknown";
  if (pages.some((page) => page?.status === "offline")) return "offline";
  if (pages.some((page) => page?.status === "degraded")) return "degraded";
  if (pages.every((page) => page?.status === "online")) return "online";
  return "unknown";
};

export const getAlertNotificationCount = (dashboardPayload) => {
  const systemStatus = dashboardPayload?.status ?? {};
  const systemEntries = [systemStatus.api, systemStatus.portfolioDb, systemStatus.reebsDb, systemStatus.faakoDb];
  const systemAlerts = systemEntries.filter((status) => status && !isHealthyStatus(status)).length;

  const siteStatuses = Array.isArray(dashboardPayload?.siteStatus?.sites)
    ? dashboardPayload.siteStatus.sites
    : [];
  const siteAlerts = siteStatuses.filter((site) => {
    const aggregateStatus = getSiteAggregateStatus(site?.pages ?? []);
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
  switch (pathname) {
    case "/dashboard":
      return "Dashboard";
    case "/accounting":
      return "Accounting";
    case "/rent":
      return "Rent";
    case "/bookings":
      return "Appointments";
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
