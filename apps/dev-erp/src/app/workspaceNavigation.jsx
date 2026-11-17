import {
  FiActivity,
  FiBarChart2,
  FiCalendar,
  FiCheckSquare,
  FiClock,
  FiFileText,
  FiFilter,
  FiGrid,
  FiLayers,
  FiList,
  FiServer,
} from "react-icons/fi";

// Section links point only to real sections or routes. They do not represent
// independent pages or introduce routes that DEV ERP does not implement.
const SECTIONS = {
  dashboard: [
    { label: "Overview", anchor: "dashboard-overview", Icon: FiGrid },
    { label: "Appointments", anchor: "availability", Icon: FiCalendar, permission: "bookings" },
    { label: "Accounting", anchor: "dashboard-accounting", Icon: FiBarChart2, permission: "accounting" },
    { label: "System status", anchor: "dashboard-monitoring", Icon: FiActivity, permission: "system-health" },
    { label: "Activity", anchor: "dashboard-activity", Icon: FiClock, permission: "system-health" },
  ],
  projects: [
    { label: "Overview", anchor: "projects-summary", Icon: FiGrid },
    { label: "Board", anchor: "projects-board", Icon: FiLayers },
    { label: "Filters", anchor: "projects-filters", Icon: FiFilter },
  ],
  bookings: [
    { label: "Overview", anchor: "bookings-summary", Icon: FiGrid },
    { label: "Schedule", anchor: "bookings-planner", Icon: FiCalendar },
    { label: "Appointments", anchor: "bookings-records", Icon: FiList },
    { label: "Holidays", anchor: "bookings-holidays", Icon: FiClock },
  ],
  accounting: [
    { label: "Overview", anchor: "accounting-summary", Icon: FiGrid },
    { label: "Ledger", anchor: "accounting-ledger", Icon: FiList },
  ],
  invoicing: [
    { label: "Overview", anchor: "invoicing-summary", Icon: FiGrid },
    { label: "Invoice ledger", anchor: "invoicing-ledger", Icon: FiFileText },
  ],
  "system-health": [
    { label: "Overview", anchor: "health-overview", Icon: FiGrid },
    { label: "Services", anchor: "health-services", Icon: FiServer },
    { label: "Published apps", anchor: "health-apps", Icon: FiLayers },
  ],
  reports: [
    { label: "Overview", anchor: "reports-overview", Icon: FiGrid },
    { label: "Reports", anchor: "reports-list", Icon: FiFileText },
  ],
};

const PROJECT_DETAIL_SECTIONS = [
  { label: "Overview", anchor: "project-detail-summary", Icon: FiGrid },
  { label: "Tasks", anchor: "project-detail-tasks", Icon: FiCheckSquare },
  { label: "Activity", anchor: "project-detail-activity", Icon: FiActivity },
];

export function getWorkspaceModule(items, pathname) {
  const path = pathname || "/dashboard";
  return [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => path === item.to || path.startsWith(item.to + "/"))
    || null;
}

export function getWorkspaceSections(module, pathname, allowedItems = []) {
  if (!module) return [];
  const entries = module.key === "projects" && pathname.startsWith("/projects/")
    ? PROJECT_DETAIL_SECTIONS : SECTIONS[module.key];
  // Standalone modules have no contextual submenu. Do not invent a one-item menu.
  if (!entries?.length) return [];
  const allowedKeys = new Set(allowedItems.map((item) => item.key));
  return entries.filter((entry) => !entry.permission || allowedKeys.has(entry.permission));
}

export function getWorkspaceSectionLink(section, pathname) {
  return section.to || `${pathname}#${section.anchor}`;
}

export function isWorkspaceSectionActive(section, pathname, hash, index) {
  if (section.to) return pathname === section.to;
  return (!hash && index === 0) || hash === `#${section.anchor}`;
}
