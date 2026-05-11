import { ERP_MODULE_STATUSES, ERP_MODULE_STATUS_LABELS } from "./moduleStatuses.js";
import { ERP_MODULE_GROUP_ORDER } from "./moduleGroups.js";
import {
  ERP_MODULE_STATES,
  ERP_MODULE_STATE_LABELS,
  ERP_MODULE_VISIBILITY,
  ERP_MODULE_VISIBILITY_LABELS,
} from "./moduleStates.js";

const DEFAULT_VISIBLE_STATUSES = new Set([
  ERP_MODULE_STATUSES.STABLE,
  ERP_MODULE_STATUSES.IN_PROGRESS,
  ERP_MODULE_STATUSES.EXPERIMENTAL,
  ERP_MODULE_STATUSES.CORE,
  ERP_MODULE_STATUSES.OPTIONAL,
]);

const DEFAULT_VISIBLE_VISIBILITIES = new Set([
  ERP_MODULE_VISIBILITY.VISIBLE,
  ERP_MODULE_VISIBILITY.INTERNAL,
]);

export const normalizeModuleKey = (key) => String(key || "").trim().toLowerCase();

export const normalizeModulePath = (path) => {
  const rawPath = String(path || "").split("#")[0].split("?")[0].trim();
  if (!rawPath) return "";
  const normalized = rawPath.replace(/\/+$/, "");
  return normalized || "/";
};

const getModulePaths = (module) => {
  const paths = [module?.path, ...(Array.isArray(module?.matchPaths) ? module.matchPaths : [])];
  return paths.map(normalizeModulePath).filter(Boolean);
};

const pathMatches = (pattern, path) => {
  const normalizedPattern = normalizeModulePath(pattern);
  const normalizedPath = normalizeModulePath(path);
  if (!normalizedPattern || !normalizedPath) return false;
  if (normalizedPattern === normalizedPath) return true;
  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, -2);
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }
  if (!normalizedPattern.includes(":")) return false;

  const patternParts = normalizedPattern.split("/").filter(Boolean);
  const pathParts = normalizedPath.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
};

const getLegacyRoutes = (module) => {
  if (Array.isArray(module?.legacyRoutes)) return module.legacyRoutes;
  if (!module?.legacyRouteTargets || typeof module.legacyRouteTargets !== "object") return [];
  return Object.entries(module.legacyRouteTargets).map(([from, to]) => ({ from, to }));
};

const toKeySet = (values = []) =>
  new Set((Array.isArray(values) ? values : []).map(normalizeModuleKey).filter(Boolean));

export const getModuleVisibility = (module) =>
  normalizeModuleKey(module?.visibility || (module?.internal ? ERP_MODULE_VISIBILITY.INTERNAL : ERP_MODULE_VISIBILITY.VISIBLE));

export const getModuleState = (module) =>
  normalizeModuleKey(
    module?.state ||
      (module?.disabled
        ? ERP_MODULE_STATES.DISABLED
        : module?.comingSoon
          ? ERP_MODULE_STATES.COMING_SOON
          : ERP_MODULE_STATES.ENABLED)
  );

const shouldIncludeModuleStatus = (module, options = {}) => {
  if (options.includeLegacy && module?.status === ERP_MODULE_STATUSES.LEGACY) return true;
  const visibleStatuses = options.visibleStatuses
    ? toKeySet(options.visibleStatuses)
    : DEFAULT_VISIBLE_STATUSES;
  const status = normalizeModuleKey(module?.status || ERP_MODULE_STATUSES.STABLE);
  return visibleStatuses.has(status);
};

const shouldIncludeModuleByConfiguredVisibility = (module, options = {}) => {
  const key = normalizeModuleKey(module?.key);
  if (!key) return false;

  const hiddenModuleKeys = toKeySet(options.hiddenModuleKeys);
  if (hiddenModuleKeys.has(key)) return false;

  const visibility = getModuleVisibility(module);
  const visibleVisibilities = options.visibleVisibilities
    ? toKeySet(options.visibleVisibilities)
    : DEFAULT_VISIBLE_VISIBILITIES;

  return module?.visible !== false && module?.hidden !== true && visibleVisibilities.has(visibility);
};

const shouldIncludeModuleByFutureGates = (module, options = {}) => {
  if (typeof options.permissionChecker === "function" && options.permissionChecker(module) === false) return false;
  if (typeof options.roleChecker === "function" && options.roleChecker(module) === false) return false;
  if (typeof options.planChecker === "function" && options.planChecker(module) === false) return false;
  if (typeof options.organizationModuleChecker === "function" && options.organizationModuleChecker(module) === false) {
    return false;
  }
  return true;
};

const mergeChildModule = (parent, child) => ({
  group: parent?.group,
  status: parent?.status,
  visibility: parent?.visibility,
  state: parent?.state,
  core: parent?.core,
  ...child,
  parentKey: child?.parentKey || parent?.key,
});

const walkModules = (modules = [], visit, parent) => {
  if (!Array.isArray(modules)) return;
  modules.forEach((module) => {
    if (!module || typeof module !== "object") return;
    const currentModule = parent ? mergeChildModule(parent, module) : module;
    visit(currentModule, parent);
    if (Array.isArray(module.children) && module.children.length > 0) {
      walkModules(module.children, visit, currentModule);
    }
  });
};

export const getModuleByKey = (modules = [], key) => {
  const normalizedKey = normalizeModuleKey(key);
  if (!normalizedKey) return undefined;
  let foundModule;
  walkModules(modules, (module) => {
    if (!foundModule && normalizeModuleKey(module?.key) === normalizedKey) {
      foundModule = module;
    }
  });
  return foundModule;
};

export const getModuleByPath = (modules = [], path) => {
  const normalizedPath = normalizeModulePath(path);
  if (!normalizedPath) return undefined;

  let foundModule;
  walkModules(modules, (module) => {
    if (foundModule) return;
    if (pathMatches(module?.path, normalizedPath)) {
      foundModule = module;
    }
  });
  if (foundModule) return foundModule;

  walkModules(modules, (module) => {
    if (!foundModule && (Array.isArray(module?.matchPaths) ? module.matchPaths : []).some((modulePath) => pathMatches(modulePath, normalizedPath))) {
      foundModule = module;
    }
  });
  if (foundModule) return foundModule;

  walkModules(modules, (module) => {
    if (foundModule) return;
    if (getLegacyRoutes(module).some((route) => normalizeModulePath(route?.from) === normalizedPath)) {
      foundModule = module;
    }
  });
  return foundModule;
};

export const getModulesByGroup = (modules = [], group) => {
  const normalizedGroup = normalizeModuleKey(group);
  if (!normalizedGroup) return [];
  return flattenModuleTree(modules).filter((module) => normalizeModuleKey(module?.group) === normalizedGroup);
};

export const isCoreModule = (module) =>
  Boolean(module?.core) || module?.status === ERP_MODULE_STATUSES.CORE;

export const getCoreModules = (modules = []) => flattenModuleTree(modules).filter(isCoreModule);

export const getOptionalModules = (modules = []) =>
  flattenModuleTree(modules).filter((module) => !isCoreModule(module) || module?.status === ERP_MODULE_STATUSES.OPTIONAL);

export const getLegacyRouteTarget = (modules = [], path) => {
  const normalizedPath = normalizeModulePath(path);
  if (!normalizedPath) return undefined;

  let legacyTarget;
  walkModules(modules, (module) => {
    if (legacyTarget) return;
    const legacyRoute = getLegacyRoutes(module).find(
      (route) => normalizeModulePath(route?.from) === normalizedPath
    );
    if (legacyRoute) legacyTarget = legacyRoute.to || module.path;
  });

  return legacyTarget;
};

export const isModuleHidden = (module) =>
  module?.hidden === true ||
  module?.visible === false ||
  getModuleVisibility(module) === ERP_MODULE_VISIBILITY.HIDDEN;

export const isModuleInternal = (module) =>
  module?.internal === true || getModuleVisibility(module) === ERP_MODULE_VISIBILITY.INTERNAL;

export const isModuleExperimental = (module) =>
  module?.experimental === true ||
  module?.status === ERP_MODULE_STATUSES.EXPERIMENTAL ||
  getModuleState(module) === ERP_MODULE_STATES.EXPERIMENTAL;

export const isModuleComingSoon = (module) =>
  module?.comingSoon === true || getModuleState(module) === ERP_MODULE_STATES.COMING_SOON;

export const isModuleDisabled = (module, options = {}) => {
  const key = normalizeModuleKey(module?.key);
  const disabledModuleKeys = toKeySet(options.disabledModuleKeys);
  if (key && disabledModuleKeys.has(key)) return true;
  return module?.disabled === true || module?.enabled === false || getModuleState(module) === ERP_MODULE_STATES.DISABLED;
};

export const isModuleEnabled = (module, options = {}) => {
  const key = normalizeModuleKey(module?.key);
  const enabledModuleKeys = toKeySet(options.enabledModuleKeys);
  if (enabledModuleKeys.size > 0 && (!key || !enabledModuleKeys.has(key))) return false;
  return !isModuleDisabled(module, options) && !isModuleComingSoon(module);
};

export const isModuleVisible = (module, options = {}) =>
  Boolean(module?.key) &&
  Boolean(module?.path || module?.external || module?.children?.length) &&
  shouldIncludeModuleStatus(module, options) &&
  shouldIncludeModuleByConfiguredVisibility(module, options) &&
  shouldIncludeModuleByFutureGates(module, options);

export const isVisibleModule = isModuleVisible;

export const flattenModuleTree = (modules = [], options = {}) => {
  const items = [];
  walkModules(modules, (module) => {
    const includeParent = module?.includeInNavigation !== false || options.includeHiddenNavigation;
    const shouldFilter = options.filterVisible !== false;
    if (!includeParent && !options.includeHiddenNavigation) return;
    if (shouldFilter && !isModuleVisible(module, options)) return;
    items.push(module);
  });
  return items;
};

export const dedupeModulesByPath = (modules = []) => {
  const seen = new Set();
  return (Array.isArray(modules) ? modules : []).filter((module) => {
    const normalizedPath = normalizeModulePath(module?.path);
    const dedupeKey = module?.external
      ? `external:${module.path || module.key}`
      : normalizedPath || `key:${normalizeModuleKey(module?.key)}`;
    if (!dedupeKey || seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
};

export const getVisibleModules = (modules = [], options = {}) =>
  dedupeModulesByPath(flattenModuleTree(modules, options));

export const filterVisibleModules = (modules = [], options = {}) =>
  dedupeModulesByPath((Array.isArray(modules) ? modules : []).filter((module) => isModuleVisible(module, options)));

export const filterEnabledModules = (modules = [], options = {}) =>
  dedupeModulesByPath(
    filterVisibleModules(modules, options).filter((module) => isModuleEnabled(module, options))
  );

export const groupModulesByGroup = (modules = [], groupOrder = ERP_MODULE_GROUP_ORDER) => {
  const grouped = new Map();
  const normalizedOrder = groupOrder.map(normalizeModuleKey).filter(Boolean);

  (Array.isArray(modules) ? modules : []).forEach((module) => {
    const group = normalizeModuleKey(module?.group || "system");
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(module);
  });

  const orderedGroups = [
    ...normalizedOrder.filter((group) => grouped.has(group)),
    ...[...grouped.keys()].filter((group) => !normalizedOrder.includes(group)).sort(),
  ];

  return orderedGroups.map((group) => ({
    group,
    modules: grouped.get(group) || [],
  }));
};

export const getModuleStatusLabel = (module, statusLabels = {}) => {
  const status = normalizeModuleKey(module?.status || ERP_MODULE_STATUSES.STABLE);
  return statusLabels[status] || ERP_MODULE_STATUS_LABELS[status] || status.replace(/_/g, " ");
};

export const getModuleVisibilityLabel = (module, visibilityLabels = {}) => {
  const visibility = getModuleVisibility(module);
  return visibilityLabels[visibility] || ERP_MODULE_VISIBILITY_LABELS[visibility] || visibility.replace(/_/g, " ");
};

export const getModuleStateLabel = (module, stateLabels = {}) => {
  const state = getModuleState(module);
  return stateLabels[state] || ERP_MODULE_STATE_LABELS[state] || state.replace(/_/g, " ");
};

export const getModuleBadges = (module, options = {}) => {
  const badges = [];
  if (isModuleExperimental(module)) badges.push({ key: "experimental", label: "Experimental" });
  if (isModuleInternal(module)) badges.push({ key: "internal", label: "Internal" });
  if (isModuleComingSoon(module)) badges.push({ key: "coming_soon", label: "Coming soon" });
  if (isModuleDisabled(module, options)) badges.push({ key: "disabled", label: "Disabled" });
  return badges;
};

// TODO: Connect database-backed module toggles, org-level module config,
// permissions integration, and SaaS plan gating through the options-based
// checker hooks above once backend persistence exists.
