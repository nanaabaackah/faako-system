const normalizeModuleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const ACTIVE_MODULE_KEYS = new Set([
  "dashboard",
  "proposals",
  "faako-onboarding",
  "rent",
  "accounting",
  "invoicing",
  "bookings",
  "organizations",
  "system-health",
  "reports",
  "audit-logs",
  "profile",
  "settings",
  "user-control",
]);

const MODULE_ROUTE_RULES = [
  { pattern: /^\/dashboard(?:\/|$)/, module: "dashboard" },
  { pattern: /^\/proposals(?:\/|$)/, module: "proposals" },
  { pattern: /^\/faako-onboarding(?:\/|$)/, module: "faako-onboarding" },
  { pattern: /^\/rent(?:\/|$)/, module: "rent" },
  { pattern: /^\/accounting(?:\/|$)/, module: "accounting" },
  { pattern: /^\/invoicing(?:\/|$)/, module: "invoicing" },
  { pattern: /^\/bookings(?:\/|$)/, module: "bookings" },
  { pattern: /^\/organizations(?:\/|$)/, module: "organizations" },
  { pattern: /^\/system-health(?:\/|$)/, module: "system-health" },
  { pattern: /^\/reports(?:\/|$)/, module: "reports" },
  { pattern: /^\/audit-logs(?:\/|$)/, module: "audit-logs" },
  { pattern: /^\/profile(?:\/|$)/, module: "profile" },
  { pattern: /^\/settings(?:\/|$)/, module: "settings" },
  { pattern: /^\/user-control(?:\/|$)/, module: "user-control" },
  { pattern: /^\/users(?:\/|$)/, module: "user-control" },
];

const MODULE_DEFAULT_PATHS = {
  dashboard: "/dashboard",
  proposals: "/proposals",
  "faako-onboarding": "/faako-onboarding",
  rent: "/rent",
  accounting: "/accounting",
  invoicing: "/invoicing",
  bookings: "/bookings",
  organizations: "/organizations",
  "system-health": "/system-health",
  reports: "/reports",
  "audit-logs": "/audit-logs",
  profile: "/profile",
  settings: "/settings",
  "user-control": "/user-control",
};

export const getAllowedModules = (user) => {
  const modulesFromRole = user?.role?.permissions?.modules;
  const modulesFromUser = user?.allowedModules;
  const source = Array.isArray(modulesFromRole)
    ? modulesFromRole
    : Array.isArray(modulesFromUser)
      ? modulesFromUser
      : [];

  return Array.from(
    new Set(
      source
        .map((module) => normalizeModuleName(module))
        .filter((module) => module && ACTIVE_MODULE_KEYS.has(module))
    )
  );
};

export const isModuleRestrictedUser = (user) => getAllowedModules(user).length > 0;

export const hasModuleAccess = (user, moduleKey) => {
  const normalizedKey = normalizeModuleName(moduleKey);
  if (!normalizedKey) return true;
  const allowedModules = getAllowedModules(user);
  if (!allowedModules.length) return true;
  return allowedModules.includes(normalizedKey);
};

export const isRentOnlyUser = (user) => {
  const allowedModules = getAllowedModules(user);
  return allowedModules.length === 1 && allowedModules[0] === "rent";
};

export const getModuleKeyForPath = (pathname) => {
  const path = String(pathname || "").trim().toLowerCase();
  if (!path) return "";
  const routeRule = MODULE_ROUTE_RULES.find((rule) => rule.pattern.test(path));
  return routeRule?.module || "";
};

export const getDefaultPathForUser = (user) => {
  if (isRentOnlyUser(user)) return "/dashboard";
  const allowedModules = getAllowedModules(user);
  if (!allowedModules.length) return "/dashboard";
  const firstModule = allowedModules.find((module) => MODULE_DEFAULT_PATHS[module]);
  return MODULE_DEFAULT_PATHS[firstModule] || "/dashboard";
};

export const canAccessPath = (user, pathname) => {
  const path = String(pathname || "").trim();
  if (!path) return true;
  if (isRentOnlyUser(user)) {
    return path === "/dashboard" || path === "/rent" || path === "/profile";
  }
  if (!isModuleRestrictedUser(user)) return true;
  const moduleKey = getModuleKeyForPath(path);
  if (!moduleKey) return true;
  return hasModuleAccess(user, moduleKey);
};
