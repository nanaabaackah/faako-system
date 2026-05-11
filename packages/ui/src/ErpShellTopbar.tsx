import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

interface ErpShellTopbarProps extends HTMLAttributes<HTMLElement> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  context?: ReactNode;
  viewer?: ReactNode;
  offlineIndicator?: ReactNode;
  syncStatus?: ReactNode;
  notificationArea?: ReactNode;
  organizationSwitcher?: ReactNode;
}

export const ErpShellTopbar = forwardRef<HTMLElement, ErpShellTopbarProps>(
  (
    {
      title,
      eyebrow,
      leading,
      actions,
      context,
      viewer,
      offlineIndicator,
      syncStatus,
      notificationArea,
      organizationSwitcher,
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <header
      ref={ref}
      className={["erp-shell-topbar", className].filter(Boolean).join(" ")}
      data-erp-shell-region="topbar"
      {...props}
    >
      <div className="erp-shell-topbar__title topbar-title">
        {leading}
        <div className="erp-shell-topbar__title-copy">
          {eyebrow ? <span className="erp-shell-topbar__eyebrow">{eyebrow}</span> : null}
          {title ? <span className="erp-shell-topbar__title-text">{title}</span> : null}
        </div>
      </div>
      <div className="erp-shell-topbar__actions topbar-actions">
        {organizationSwitcher ? (
          <div className="erp-shell-topbar__slot" data-erp-shell-placeholder="organization-switcher">
            {organizationSwitcher}
          </div>
        ) : null}
        {offlineIndicator ? (
          <div className="erp-shell-topbar__slot" data-erp-shell-placeholder="offline-indicator">
            {offlineIndicator}
          </div>
        ) : null}
        {syncStatus ? (
          <div className="erp-shell-topbar__slot" data-erp-shell-placeholder="sync-status">
            {syncStatus}
          </div>
        ) : null}
        {notificationArea ? (
          <div className="erp-shell-topbar__slot" data-erp-shell-placeholder="notification-area">
            {notificationArea}
          </div>
        ) : null}
        {context ? <span className="erp-shell-topbar__context erp-topbar__context">{context}</span> : null}
        {viewer ? <span className="erp-shell-topbar__viewer erp-topbar__viewer">{viewer}</span> : null}
        {actions}
        {children}
      </div>
    </header>
  ),
);

ErpShellTopbar.displayName = "ErpShellTopbar";

// TODO: Connect org branding, offline sync, notification center, and
// multi-tenant switcher data here once each app has backend-owned sources.
