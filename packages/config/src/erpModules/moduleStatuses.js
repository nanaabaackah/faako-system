export const ERP_MODULE_STATUSES = Object.freeze({
  STABLE: "stable",
  IN_PROGRESS: "in_progress",
  EXPERIMENTAL: "experimental",
  CORE: "core",
  OPTIONAL: "optional",
  LEGACY: "legacy",
});

export const ERP_MODULE_STATUS_LABELS = Object.freeze({
  [ERP_MODULE_STATUSES.STABLE]: "Stable",
  [ERP_MODULE_STATUSES.IN_PROGRESS]: "In progress",
  [ERP_MODULE_STATUSES.EXPERIMENTAL]: "Experimental",
  [ERP_MODULE_STATUSES.CORE]: "Core",
  [ERP_MODULE_STATUSES.OPTIONAL]: "Optional",
  [ERP_MODULE_STATUSES.LEGACY]: "Legacy",
});
