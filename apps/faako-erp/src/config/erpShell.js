import {
  defineErpShellConfig,
  getModuleBadges,
  getModuleState,
  getModuleStatusLabel,
  getModuleVisibility,
  getVisibleModules,
  isModuleEnabled,
} from "@faako/config";
import { FAAKO_ERP_ADMIN_MODULES } from "./adminModules.js";

const sortByOrder = (items = [], orderKey) =>
  [...items].sort((left, right) => Number(left?.[orderKey] || 0) - Number(right?.[orderKey] || 0));

const toShellItem = (module, labelKey = "label") => ({
  id: module.key,
  defaultLabel: module[labelKey] || module.label,
  path: module.path,
  iconKey: module.key,
  group: module.group,
  status: module.status,
  state: getModuleState(module),
  visibility: getModuleVisibility(module),
  statusLabel: getModuleStatusLabel(module),
  badges: getModuleBadges(module),
  enabled: isModuleEnabled(module),
  core: Boolean(module.core),
});

const getSidebarItems = () =>
  sortByOrder(
    // TODO: Pass database-backed module toggles, org-level module config,
    // permissions integration, and SaaS plan gating into getVisibleModules
    // after those controls exist server-side.
    getVisibleModules(FAAKO_ERP_ADMIN_MODULES).filter((module) => module.sidebar !== false),
    "navOrder"
  ).map((module) => toShellItem(module));

const getBottomNavItems = () =>
  sortByOrder(
    getVisibleModules(FAAKO_ERP_ADMIN_MODULES).filter((module) => module.bottomNav),
    "bottomOrder"
  ).map((module) => toShellItem(module, "defaultBottomLabel"));

const applyLabels = (items, overrides = {}) =>
  items.map(({ defaultLabel, ...item }) => ({
    ...item,
    label: overrides[item.id] || defaultLabel,
  }));

const buildPageTitles = (items) => {
  const titles = {};
  items.forEach((item) => {
    titles[item.path] = item.label;
  });
  return titles;
};

export const getErpShellConfig = (scenario) => {
  const navigation = scenario?.navigation || {};
  const resolvedSidebarItems = applyLabels(getSidebarItems(), navigation.labels);
  const resolvedBottomNavItems = applyLabels(getBottomNavItems(), navigation.bottomLabels);

  return defineErpShellConfig({
    brand: scenario.brand,
    sidebarItems: resolvedSidebarItems,
    bottomNavItems: resolvedBottomNavItems,
    pageTitles: buildPageTitles(resolvedSidebarItems),
  });
};
