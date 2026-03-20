export const normalizeAdminRole = (role) => String(role || "").trim().toLowerCase();

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

export const getAdminQuickActions = (role) => {
  const normalizedRole = normalizeAdminRole(role);
  if (normalizedRole === "water") {
    return ADMIN_QUICK_ACTIONS.filter((item) => item.path === "/admin/water");
  }
  return ADMIN_QUICK_ACTIONS;
};
