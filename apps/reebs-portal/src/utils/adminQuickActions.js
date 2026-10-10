import {
  canAccessPortalNavigationItem,
  normalizeAdminRole,
} from "./adminAccess";
import { WATER_APP_URL } from "../config/appUrls.js";

export const ADMIN_QUICK_ACTIONS = [
  { label: "Directory", path: "/admin/directory" },
  { label: "Accounting", path: "/admin/accounting" },
  { label: "Expenses", path: "/admin/expenses" },
  { label: "Vendors", path: "/admin/vendors" },
  { label: "Delivery", path: "/admin/delivery" },
  { label: "Documents", path: "/admin/documents" },
  { label: "Timesheets", path: "/admin/timesheets" },
  { label: "Water", path: WATER_APP_URL, external: true, roles: ["owner", "admin", "manager", "water"] },
];

export { normalizeAdminRole };

export const getAdminQuickActions = (role) => {
  const normalizedRole = normalizeAdminRole(role);
  return ADMIN_QUICK_ACTIONS.filter((item) => canAccessPortalNavigationItem(normalizedRole, item));
};
