const DASHBOARD_WINDOWS = Object.freeze({
  today: Object.freeze({ key: "today", label: "Today", days: 1 }),
  "7d": Object.freeze({ key: "7d", label: "Last 7 days", days: 7 }),
  "30d": Object.freeze({ key: "30d", label: "Last 30 days", days: 30 }),
  thisMonth: Object.freeze({ key: "thisMonth", label: "This month", days: null }),
});

const ATTENTION_PRIORITY = Object.freeze({
  critical: 1,
  warning: 2,
  info: 3,
});

const normalizeDashboardWindow = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "today") return "today";
  if (["7d", "7days", "last7days"].includes(normalized)) return "7d";
  if (["thismonth", "this_month", "month"].includes(normalized)) return "thisMonth";
  return "30d";
};

const getDashboardWindow = (value, nowInput = new Date()) => {
  const key = normalizeDashboardWindow(value);
  const now = new Date(nowInput);
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;
  const startOfToday = new Date(Date.UTC(
    safeNow.getUTCFullYear(),
    safeNow.getUTCMonth(),
    safeNow.getUTCDate()
  ));
  const start = key === "today"
    ? startOfToday
    : key === "thisMonth"
      ? new Date(Date.UTC(safeNow.getUTCFullYear(), safeNow.getUTCMonth(), 1))
      : new Date(safeNow.getTime() - DASHBOARD_WINDOWS[key].days * 24 * 60 * 60 * 1000);

  return {
    ...DASHBOARD_WINDOWS[key],
    start,
    end: safeNow,
  };
};

const createAttentionItem = ({
  id,
  severity = "info",
  count = 0,
  label,
  detail,
  href,
  actionLabel = "Review",
}) => ({
  id,
  severity: ATTENTION_PRIORITY[severity] ? severity : "info",
  priority: ATTENTION_PRIORITY[severity] || ATTENTION_PRIORITY.info,
  count: Math.max(0, Number(count) || 0),
  label,
  detail,
  action: href ? { label: actionLabel, href } : null,
});

const sortAttentionItems = (items = []) => [...items]
  .filter((item) => Number(item?.count || 0) > 0)
  .sort((left, right) => (
    Number(left.priority || ATTENTION_PRIORITY.info) - Number(right.priority || ATTENTION_PRIORITY.info)
    || Number(right.count || 0) - Number(left.count || 0)
    || String(left.label || "").localeCompare(String(right.label || ""))
  ));

const buildDashboardPermissions = (authUser, hasPermission) => ({
  canReadOrders: hasPermission(authUser, "orders:read"),
  canWriteOrders: hasPermission(authUser, "orders:write"),
  canReadBookings: hasPermission(authUser, "bookings:read"),
  canWriteBookings: hasPermission(authUser, "bookings:write"),
  canReadInventory: hasPermission(authUser, "inventory:read"),
  canConfigureInventory: hasPermission(authUser, "inventory:approve"),
  canReadDelivery: hasPermission(authUser, "deliveries:read"),
  canReadFinancials: hasPermission(authUser, "financials:read"),
  canReadCustomers: hasPermission(authUser, "customers:read"),
  canWriteCustomers: hasPermission(authUser, "customers:write"),
  canReadWater: hasPermission(authUser, "water:read"),
  canViewSystemHealthDetail: ["owner", "admin", "manager"].includes(
    String(authUser?.role || "").trim().toLowerCase()
  ),
});

export {
  ATTENTION_PRIORITY,
  DASHBOARD_WINDOWS,
  buildDashboardPermissions,
  createAttentionItem,
  getDashboardWindow,
  normalizeDashboardWindow,
  sortAttentionItems,
};
