import type { CSSProperties, ReactNode } from "react";
import type { ErpBranding } from "@faako/types";

interface ErpShellFrameProps {
  brand?: ErpBranding;
  layout?: "overlay" | "split";
  className?: string;
  contentClassName?: string;
  sidebarCollapsed?: boolean;
  mobileNavOpen?: boolean;
  offline?: boolean;
  syncing?: boolean;
  sidebar?: ReactNode;
  topbar?: ReactNode;
  offlineIndicator?: ReactNode;
  syncStatus?: ReactNode;
  notificationArea?: ReactNode;
  organizationSwitcher?: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
}

const toInlineShellVars = (shellVars: Record<string, string> = {}) => {
  const style: CSSProperties = {};

  Object.entries(shellVars).forEach(([key, value]) => {
    const cssVar = key.startsWith("--") ? key : `--${key}`;
    style[cssVar as keyof CSSProperties] = value;
  });

  return style;
};

export function ErpShellFrame({
  brand,
  layout = "overlay",
  className,
  contentClassName,
  sidebarCollapsed = false,
  mobileNavOpen = false,
  offline = false,
  syncing = false,
  sidebar,
  topbar,
  offlineIndicator,
  syncStatus,
  notificationArea,
  organizationSwitcher,
  bottomNav,
  children,
}: ErpShellFrameProps) {
  const shellClassName = [
    "erp-shell-frame",
    `erp-shell-frame--${layout}`,
    sidebarCollapsed ? "is-sidebar-collapsed" : "",
    mobileNavOpen ? "is-mobile-nav-open" : "",
    offline ? "is-offline" : "",
    syncing ? "is-syncing" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const shellContentClassName = [
    "erp-shell-frame__content",
    `erp-shell-frame__content--${layout}`,
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellClassName}
      data-erp-shell-region="frame"
      data-erp-shell-layout={layout}
      style={toInlineShellVars(brand?.shellVars)}
    >
      {sidebar}
      <div className={shellContentClassName} data-erp-shell-region="content">
        {topbar}
        {organizationSwitcher || offlineIndicator || syncStatus || notificationArea ? (
          <div className="erp-shell-frame__placeholders" aria-label="Shell status">
            {organizationSwitcher ? (
              <div className="erp-shell-frame__placeholder" data-erp-shell-placeholder="organization-switcher">
                {organizationSwitcher}
              </div>
            ) : null}
            {offlineIndicator ? (
              <div className="erp-shell-frame__placeholder" data-erp-shell-placeholder="offline-indicator">
                {offlineIndicator}
              </div>
            ) : null}
            {syncStatus ? (
              <div className="erp-shell-frame__placeholder" data-erp-shell-placeholder="sync-status">
                {syncStatus}
              </div>
            ) : null}
            {notificationArea ? (
              <div className="erp-shell-frame__placeholder" data-erp-shell-placeholder="notification-area">
                {notificationArea}
              </div>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
      {bottomNav}
    </div>
  );
}

// TODO: Feed module toggles, org-aware branding, offline sync state,
// notifications, and multi-tenant context through these slots once app
// backends expose stable shell metadata.
