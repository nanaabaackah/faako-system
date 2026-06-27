const LEGACY_ROLE_ALIASES = {
  viewer: "staff",
  custodian: "staff",
  sales: "staff",
};

const normalizeAdminRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return LEGACY_ROLE_ALIASES[normalized] || normalized;
};

const STANDARD_PORTAL_ROLES = ["owner", "admin", "manager", "staff", "warehouse"];
const OWNER_ADMIN_ROLES = ["owner", "admin"];
const PRIVILEGED_PORTAL_ROLES = ["owner", "admin", "manager"];
const DRIVER_PORTAL_ROLES = ["driver"];
const WATER_PORTAL_ROLES = ["owner", "admin", "manager", "water"];

const roleMatchesAllowedRoles = (role, allowedRoles = []) => {
  const normalizedRole = normalizeAdminRole(role);
  const normalizedAllowed = new Set(
    (Array.isArray(allowedRoles) ? allowedRoles : []).map(normalizeAdminRole).filter(Boolean)
  );

  if (!normalizedRole || normalizedAllowed.size === 0) return false;
  if (normalizedAllowed.has(normalizedRole)) return true;

  // Owners inherit the standard privileged admin/manager areas.
  if (
    normalizedRole === "owner"
    && (normalizedAllowed.has("admin") || normalizedAllowed.has("manager"))
  ) {
    return true;
  }

  return false;
};

const isWaterPortalRole = (role) => normalizeAdminRole(role) === "water";
const isDriverPortalRole = (role) => roleMatchesAllowedRoles(role, DRIVER_PORTAL_ROLES);

const canAccessStandardPortalArea = (role) => {
  return roleMatchesAllowedRoles(role, STANDARD_PORTAL_ROLES);
};

const canAccessOwnerAdminPortalArea = (role) =>
  roleMatchesAllowedRoles(role, OWNER_ADMIN_ROLES);

const canAccessPrivilegedPortalArea = (role) =>
  roleMatchesAllowedRoles(role, PRIVILEGED_PORTAL_ROLES);

const canAccessWaterPortalArea = (role) =>
  roleMatchesAllowedRoles(role, WATER_PORTAL_ROLES);

const canAccessPortalCustomerDirectory = (role) =>
  canAccessStandardPortalArea(role) || isDriverPortalRole(role);
const canAccessPortalInventory = (role) => canAccessStandardPortalArea(role);
const canAccessPortalOrders = (role) => canAccessStandardPortalArea(role);
const canAccessPortalBookings = (role) =>
  canAccessPrivilegedPortalArea(role) || isDriverPortalRole(role);
const canAccessPortalDelivery = (role) =>
  canAccessPrivilegedPortalArea(role) || isDriverPortalRole(role);
const canAccessPortalTimesheets = (role) => canAccessStandardPortalArea(role);

const normalizeAdminPath = (path) => {
  const [pathname = ""] = String(path || "").split("?");
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/admin";
};

const canAccessPortalRoute = (role, path = "") => {
  const normalizedPath = normalizeAdminPath(path);

  if (normalizedPath === "/admin" || normalizedPath === "/admin/profile") return true;

  if (normalizedPath === "/admin/water") {
    return canAccessWaterPortalArea(role);
  }

  if (
    normalizedPath === "/admin/inventory/products"
    || normalizedPath === "/admin/inventory/templates"
  ) {
    return canAccessOwnerAdminPortalArea(role);
  }

  if (
    normalizedPath === "/admin/bookings"
  ) {
    return canAccessPortalBookings(role);
  }

  if (normalizedPath === "/admin/delivery") {
    return canAccessPortalDelivery(role);
  }

  if (
    normalizedPath === "/admin/schedule"
    || normalizedPath === "/admin/accounting"
    || normalizedPath === "/admin/expenses"
    || normalizedPath === "/admin/vendors"
    || normalizedPath === "/admin/documents"
    || normalizedPath === "/admin/settings"
    || normalizedPath === "/admin/hr"
    || normalizedPath === "/admin/roles"
    || normalizedPath === "/admin/invoicing"
    || normalizedPath === "/admin/marketing"
    || normalizedPath === "/admin/advanced"
    || normalizedPath === "/admin/website-template"
  ) {
    return canAccessPrivilegedPortalArea(role);
  }

  if (
    normalizedPath === "/admin/reports"
    || normalizedPath === "/admin/audit-logs"
  ) {
    return canAccessOwnerAdminPortalArea(role);
  }

  if (normalizedPath === "/admin/directory") {
    return canAccessPortalCustomerDirectory(role);
  }

  if (normalizedPath === "/admin/crm" || normalizedPath === "/admin/customers") {
    return canAccessStandardPortalArea(role);
  }

  if (
    normalizedPath === "/admin/store-mode"
    || normalizedPath === "/admin/inventory"
    || normalizedPath === "/admin/purchases"
    || normalizedPath === "/admin/offline"
    || normalizedPath === "/admin/orders"
    || normalizedPath === "/admin/orders/new"
    || normalizedPath === "/admin/users"
    || normalizedPath === "/admin/employees"
    || normalizedPath === "/admin/maintenance"
    || normalizedPath === "/admin/timesheets"
    || normalizedPath === "/admin/rentals"
  ) {
    return canAccessStandardPortalArea(role);
  }

  return canAccessStandardPortalArea(role);
};

const canAccessPortalNavigationItem = (role, item = {}) => {
  if (item.external) {
    if (Array.isArray(item.roles) && item.roles.length > 0) {
      return roleMatchesAllowedRoles(role, item.roles);
    }
    return canAccessStandardPortalArea(role);
  }

  if (Array.isArray(item.roles) && item.roles.length > 0) {
    return roleMatchesAllowedRoles(role, item.roles);
  }

  return canAccessPortalRoute(role, item.path);
};

const getPortalAccessFallbackPath = (role) => {
  if (isWaterPortalRole(role)) return "/admin/water";
  if (isDriverPortalRole(role)) return "/admin/bookings";
  if (canAccessStandardPortalArea(role)) return "/admin";
  return "/admin/profile";
};

export {
  DRIVER_PORTAL_ROLES,
  OWNER_ADMIN_ROLES,
  PRIVILEGED_PORTAL_ROLES,
  STANDARD_PORTAL_ROLES,
  WATER_PORTAL_ROLES,
  canAccessPortalDelivery,
  canAccessOwnerAdminPortalArea,
  canAccessPortalBookings,
  canAccessPortalCustomerDirectory,
  canAccessPortalInventory,
  canAccessPortalNavigationItem,
  canAccessPortalOrders,
  canAccessPortalRoute,
  canAccessPortalTimesheets,
  canAccessPrivilegedPortalArea,
  canAccessStandardPortalArea,
  canAccessWaterPortalArea,
  getPortalAccessFallbackPath,
  isDriverPortalRole,
  isWaterPortalRole,
  normalizeAdminRole,
  normalizeAdminPath,
  roleMatchesAllowedRoles,
};
