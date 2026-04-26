const normalizeAdminRole = (role) => String(role || "").trim().toLowerCase();

const OWNER_ADMIN_ROLES = ["owner", "admin"];
const PRIVILEGED_PORTAL_ROLES = ["owner", "admin", "manager"];
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

const canAccessStandardPortalArea = (role) => {
  const normalizedRole = normalizeAdminRole(role);
  return Boolean(normalizedRole) && normalizedRole !== "water";
};

const canAccessOwnerAdminPortalArea = (role) =>
  roleMatchesAllowedRoles(role, OWNER_ADMIN_ROLES);

const canAccessPrivilegedPortalArea = (role) =>
  roleMatchesAllowedRoles(role, PRIVILEGED_PORTAL_ROLES);

const canAccessWaterPortalArea = (role) =>
  roleMatchesAllowedRoles(role, WATER_PORTAL_ROLES);

const canAccessPortalCustomerDirectory = (role) => canAccessStandardPortalArea(role);
const canAccessPortalInventory = (role) => canAccessStandardPortalArea(role);
const canAccessPortalOrders = (role) => canAccessStandardPortalArea(role);
const canAccessPortalBookings = (role) => canAccessPrivilegedPortalArea(role);
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
    || normalizedPath === "/admin/schedule"
    || normalizedPath === "/admin/accounting"
    || normalizedPath === "/admin/expenses"
    || normalizedPath === "/admin/vendors"
    || normalizedPath === "/admin/delivery"
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
    normalizedPath === "/admin/store-mode"
    || normalizedPath === "/admin/inventory"
    || normalizedPath === "/admin/purchases"
    || normalizedPath === "/admin/offline"
    || normalizedPath === "/admin/orders"
    || normalizedPath === "/admin/orders/new"
    || normalizedPath === "/admin/crm"
    || normalizedPath === "/admin/customers"
    || normalizedPath === "/admin/users"
    || normalizedPath === "/admin/employees"
    || normalizedPath === "/admin/directory"
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

const getPortalAccessFallbackPath = (role) =>
  isWaterPortalRole(role) ? "/admin/water" : "/admin";

export {
  OWNER_ADMIN_ROLES,
  PRIVILEGED_PORTAL_ROLES,
  WATER_PORTAL_ROLES,
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
  isWaterPortalRole,
  normalizeAdminRole,
  normalizeAdminPath,
  roleMatchesAllowedRoles,
};
