export const ERP_SHELL_PLACEHOLDER_SLOTS = Object.freeze({
  OFFLINE_INDICATOR: "offlineIndicator",
  SYNC_STATUS: "syncStatus",
  NOTIFICATION_AREA: "notificationArea",
  ORGANIZATION_SWITCHER: "organizationSwitcher",
});

export const ERP_SHELL_PLACEHOLDER_LABELS = Object.freeze({
  [ERP_SHELL_PLACEHOLDER_SLOTS.OFFLINE_INDICATOR]: "Offline indicator",
  [ERP_SHELL_PLACEHOLDER_SLOTS.SYNC_STATUS]: "Sync status",
  [ERP_SHELL_PLACEHOLDER_SLOTS.NOTIFICATION_AREA]: "Notifications",
  [ERP_SHELL_PLACEHOLDER_SLOTS.ORGANIZATION_SWITCHER]: "Organization switcher",
});

export const ERP_SHELL_STATUS_BADGES = Object.freeze({
  STABLE: "stable",
  IN_PROGRESS: "in_progress",
  EXPERIMENTAL: "experimental",
  INTERNAL: "internal",
  COMING_SOON: "coming_soon",
});

export const ERP_SHELL_STATUS_BADGE_LABELS = Object.freeze({
  [ERP_SHELL_STATUS_BADGES.STABLE]: "Stable",
  [ERP_SHELL_STATUS_BADGES.IN_PROGRESS]: "In progress",
  [ERP_SHELL_STATUS_BADGES.EXPERIMENTAL]: "Experimental",
  [ERP_SHELL_STATUS_BADGES.INTERNAL]: "Internal",
  [ERP_SHELL_STATUS_BADGES.COMING_SOON]: "Coming soon",
});

const normalizeShellKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_");

export const defineErpShellFoundation = (foundation = {}) => foundation;

export const getErpShellStatusBadge = (status, labels = {}) => {
  const key = normalizeShellKey(status || ERP_SHELL_STATUS_BADGES.STABLE);
  return {
    key,
    label: labels[key] || ERP_SHELL_STATUS_BADGE_LABELS[key] || key.replace(/_/g, " "),
  };
};

export const getErpShellPlaceholderLabel = (slot, labels = {}) => {
  const key = slot || "";
  return labels[key] || ERP_SHELL_PLACEHOLDER_LABELS[key] || String(key).replace(/([A-Z])/g, " $1").trim();
};

export const getDefaultErpShellPlaceholders = () => ({
  [ERP_SHELL_PLACEHOLDER_SLOTS.OFFLINE_INDICATOR]: true,
  [ERP_SHELL_PLACEHOLDER_SLOTS.SYNC_STATUS]: true,
  [ERP_SHELL_PLACEHOLDER_SLOTS.NOTIFICATION_AREA]: true,
  [ERP_SHELL_PLACEHOLDER_SLOTS.ORGANIZATION_SWITCHER]: true,
});

// TODO: Wire module toggles, org branding, offline sync, notifications,
// and multi-tenant shell settings into this config layer after persistence
// and access-control ownership are designed.
