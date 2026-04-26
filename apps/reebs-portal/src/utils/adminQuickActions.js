import {
  canAccessPortalRoute,
  normalizeAdminRole,
} from "./adminAccess";

export const ADMIN_QUICK_ACTIONS = [
  { label: "Directory", path: "/admin/directory" },
  { label: "Accounting", path: "/admin/accounting" },
  { label: "Expenses", path: "/admin/expenses" },
  { label: "Vendors", path: "/admin/vendors" },
  { label: "Delivery", path: "/admin/delivery" },
  { label: "Documents", path: "/admin/documents" },
  { label: "Timesheets", path: "/admin/timesheets" },
  { label: "Water", path: "/admin/water" },
];

export { normalizeAdminRole };

export const getAdminQuickActions = (role) => {
  const normalizedRole = normalizeAdminRole(role);
  return ADMIN_QUICK_ACTIONS.filter((item) =>
    canAccessPortalRoute(normalizedRole, item.path)
  );
};
