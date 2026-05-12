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
import {
  faBoxesStacked,
  faBullhorn,
  faCalendarCheck,
  faCalendarDays,
  faChartLine,
  faClock,
  faFileInvoiceDollar,
  faFileLines,
  faGlobe,
  faHome,
  faMoneyCheckDollar,
  faReceipt,
  faShieldAlt,
  faSliders,
  faStore,
  faTools,
  faTruck,
  faUserGroup,
  faUserTie,
  faUsers,
} from "/src/icons/iconSet";
import { WEBSITE_URL } from "../utils/website.js";
import { REEBS_ADMIN_MODULES } from "./adminModules.js";

const STANDARD_NAV_ROLES = ["admin", "manager", "staff", "warehouse"];
const PRIVILEGED_NAV_ROLES = ["admin", "manager"];
const OWNER_ADMIN_NAV_ROLES = ["admin"];

const SIDEBAR_ICONS_BY_KEY = {
  "audit-log": faFileLines,
  accounting: faChartLine,
  bookings: faCalendarDays,
  customers: faUserGroup,
  delivery: faTruck,
  directory: faUsers,
  documents: faFileLines,
  expenses: faMoneyCheckDollar,
  finance: faChartLine,
  home: faHome,
  hr: faUserTie,
  inventory: faBoxesStacked,
  invoicing: faFileInvoiceDollar,
  maintenance: faTools,
  marketing: faBullhorn,
  pos: faReceipt,
  rentals: faBoxesStacked,
  reports: faChartLine,
  roles: faShieldAlt,
  schedule: faCalendarCheck,
  settings: faSliders,
  team: faUserGroup,
  timesheets: faClock,
  vendors: faStore,
  water: faStore,
  website: faGlobe,
};

const BOTTOM_ICONS_BY_KEY = {
  bookings: faCalendarDays,
  delivery: faTruck,
  directory: faUserGroup,
  home: faHome,
  inventory: faBoxesStacked,
  pos: faStore,
  purchases: faReceipt,
  water: faBoxesStacked,
};

const getRolesForPermission = (requiredPermission) => {
  switch (requiredPermission) {
    case "standard":
      return STANDARD_NAV_ROLES;
    case "ownerAdmin":
      return OWNER_ADMIN_NAV_ROLES;
    case "privileged":
      return PRIVILEGED_NAV_ROLES;
    case "water":
      return PRIVILEGED_NAV_ROLES;
    default:
      return undefined;
  }
};

const toSidebarItem = (module) => {
  const roles = module.key === "directory" || module.key === "team"
    ? STANDARD_NAV_ROLES
    : getRolesForPermission(module.requiredPermission);
  return {
    id: module.key,
    moduleKey: module.key,
    group: module.group,
    status: module.status,
    state: getModuleState(module),
    visibility: getModuleVisibility(module),
    statusLabel: getModuleStatusLabel(module),
    badges: getModuleBadges(module),
    enabled: isModuleEnabled(module),
    core: Boolean(module.core),
    label: module.navLabel || module.label,
    path: module.key === "website" ? WEBSITE_URL : module.path,
    matchPaths: module.matchPaths,
    icon: SIDEBAR_ICONS_BY_KEY[module.key] || faHome,
    external: Boolean(module.external),
    description: module.description,
    ...(roles ? { roles } : {}),
  };
};

export const getReebsSidebarNavItems = () =>
  // TODO: Pass database-backed module toggles, org-level module config,
  // permissions integration, and SaaS plan gating into getVisibleModules
  // after those controls exist server-side.
  getVisibleModules(REEBS_ADMIN_MODULES)
    .filter((module) => module.sidebar !== false)
    .map(toSidebarItem);

const buildBottomItem = (moduleKey, overrides = {}) => {
  const module = getModuleByKey(REEBS_ADMIN_MODULES, moduleKey);
  if (!module || !isModuleVisible(module)) return null;
  return {
    id: module.key,
    moduleKey: module.key,
    group: module.group,
    status: module.status,
    state: getModuleState(module),
    visibility: getModuleVisibility(module),
    statusLabel: getModuleStatusLabel(module),
    badges: getModuleBadges(module),
    enabled: isModuleEnabled(module),
    core: Boolean(module.core),
    label: module.navLabel || module.label,
    path: module.path,
    icon: BOTTOM_ICONS_BY_KEY[module.key] || faHome,
    ...overrides,
  };
};

const BASE_BOTTOM_NAV_ITEMS = [
  buildBottomItem("home", { label: "Home" }),
  buildBottomItem("inventory", { label: "Stock" }),
  buildBottomItem("purchases", { label: "Buy" }),
  buildBottomItem("pos", { label: "POS" }),
].filter(Boolean);

const DRIVER_BOTTOM_NAV_ITEMS = [
  buildBottomItem("home", { label: "Home" }),
  buildBottomItem("bookings", { label: "Bookings" }),
  buildBottomItem("delivery", { label: "Delivery" }),
  buildBottomItem("directory", {
    id: "customers",
    label: "Customers",
    path: "/admin/directory?tab=customers",
  }),
].filter(Boolean);

const WATER_BOTTOM_NAV_ITEM = buildBottomItem("water", { label: "Water" });
export const WATER_BOTTOM_NAV_ITEMS = WATER_BOTTOM_NAV_ITEM ? [WATER_BOTTOM_NAV_ITEM] : [];

export const getReebsBaseBottomNavItems = () => BASE_BOTTOM_NAV_ITEMS;
export const getReebsDriverBottomNavItems = () => DRIVER_BOTTOM_NAV_ITEMS;
