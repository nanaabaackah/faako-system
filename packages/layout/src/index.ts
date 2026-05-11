export const ERP_SHELL_LAYOUTS = Object.freeze({
  OVERLAY: "overlay",
  SPLIT: "split",
});

export const ERP_SHELL_REGIONS = Object.freeze({
  FRAME: "frame",
  SIDEBAR: "sidebar",
  TOPBAR: "topbar",
  MOBILE_NAV: "mobile-nav",
  CONTENT: "content",
  PAGE_HEADER: "page-header",
  MODULE_GROUP: "module-group",
});

export const ERP_SHELL_PLACEHOLDER_REGIONS = Object.freeze({
  OFFLINE_INDICATOR: "offline-indicator",
  SYNC_STATUS: "sync-status",
  NOTIFICATION_AREA: "notification-area",
  ORGANIZATION_SWITCHER: "organization-switcher",
});

export const ERP_SHELL_BREAKPOINTS = Object.freeze({
  MOBILE_MAX: 900,
  DESKTOP_MIN: 901,
});

export const joinErpLayoutClassNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export const getErpShellRegionProps = (region: string, extraProps: Record<string, string> = {}) => ({
  "data-erp-shell-region": region,
  ...extraProps,
});

export const getErpShellFrameClassName = ({
  layout = ERP_SHELL_LAYOUTS.OVERLAY,
  sidebarCollapsed = false,
  mobileNavOpen = false,
  offline = false,
  syncing = false,
  className,
}: {
  layout?: string;
  sidebarCollapsed?: boolean;
  mobileNavOpen?: boolean;
  offline?: boolean;
  syncing?: boolean;
  className?: string;
} = {}) =>
  joinErpLayoutClassNames(
    "erp-shell-frame",
    `erp-shell-frame--${layout}`,
    sidebarCollapsed && "is-sidebar-collapsed",
    mobileNavOpen && "is-mobile-nav-open",
    offline && "is-offline",
    syncing && "is-syncing",
    className,
  );

export const getErpStatusBadgeClassName = (status: string, className?: string) => {
  const normalized = String(status || "stable").trim().toLowerCase().replace(/\s+/g, "_");
  return joinErpLayoutClassNames(
    "erp-status-badge",
    `erp-status-badge--${normalized}`,
    `is-${normalized}`,
    className,
  );
};

export const getErpModuleGroupClassName = (group: string, className?: string) => {
  const normalized = String(group || "system").trim().toLowerCase().replace(/\s+/g, "_");
  return joinErpLayoutClassNames(
    "erp-module-group",
    `erp-module-group--${normalized}`,
    className,
  );
};

// TODO: Feed module toggles, org branding, offline sync, notifications,
// and multi-tenant context into these shell contracts once backend-owned
// app settings exist.
