import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export { ToastProvider as ERPToastProvider, useToast as useERPToast } from "./Feedback";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export type ERPNotificationTone =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading"
  | "offline"
  | "sync"
  | "pending"
  | "maintenance"
  | "degraded"
  | "neutral";

const ERP_TONE_META: Record<
  ERPNotificationTone,
  { title: string; role: "status" | "alert"; live: "polite" | "assertive" }
> = {
  success: { title: "Saved successfully", role: "status", live: "polite" },
  error: { title: "Action needed", role: "alert", live: "assertive" },
  warning: { title: "Check this step", role: "alert", live: "assertive" },
  info: { title: "Heads up", role: "status", live: "polite" },
  loading: { title: "Working on it", role: "status", live: "polite" },
  offline: { title: "You're offline", role: "status", live: "polite" },
  sync: { title: "Syncing changes", role: "status", live: "polite" },
  pending: { title: "Pending", role: "status", live: "polite" },
  maintenance: { title: "Maintenance mode", role: "alert", live: "assertive" },
  degraded: { title: "Limited service", role: "alert", live: "assertive" },
  neutral: { title: "Note", role: "status", live: "polite" },
};

function ERPNoticeGlyph({ tone }: { tone: ERPNotificationTone }) {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.8 10.2L9.2 12.6L13.4 7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7.2 7.2L12.8 12.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12.8 7.2L7.2 12.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (tone === "warning" || tone === "maintenance") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <path d="M10 3.5L17 15.5H3L10 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M10 7.4V10.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="13.2" r="0.8" fill="currentColor" />
      </svg>
    );
  }

  if (tone === "loading") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <path
          d="M10 3.5C13.59 3.5 16.5 6.41 16.5 10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M16.5 10C16.5 13.59 13.59 16.5 10 16.5C6.41 16.5 3.5 13.59 3.5 10C3.5 6.41 6.41 3.5 10 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          opacity="0.28"
        />
      </svg>
    );
  }

  if (tone === "offline") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.5 13.5L13.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (tone === "sync" || tone === "degraded") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <path
          d="M3.5 7.5C5 5 7.3 3.5 10 3.5c2.8 0 5.2 1.5 6.5 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M16.5 12.5C15 15 12.7 16.5 10 16.5c-2.8 0-5.2-1.5-6.5-4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M14 3.5l2.5 4-4 .5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 16.5l-2.5-4 4-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // info and neutral share the same glyph; color is controlled by CSS
  return (
    <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 8V12.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="6.2" r="0.8" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ERPNotice — inline contextual notice for use within forms, panels, and settings
// ---------------------------------------------------------------------------

export function ERPNotice({
  tone = "info",
  title,
  message,
  compact = false,
  className = "",
  actions,
}: {
  tone?: ERPNotificationTone;
  title?: string;
  message?: ReactNode;
  compact?: boolean;
  className?: string;
  actions?: ReactNode;
}) {
  const meta = ERP_TONE_META[tone] ?? ERP_TONE_META.info;
  const resolvedTitle = title || meta.title;
  const isAnimating = tone === "loading" || tone === "sync";

  return (
    <div
      className={joinClasses(
        "ui-inline-notice",
        `ui-inline-notice--${tone}`,
        compact && "is-compact",
        className,
      )}
      role={meta.role}
      aria-live={meta.live}
    >
      <span
        className={joinClasses("ui-inline-notice__icon", isAnimating && "is-spinning")}
        aria-hidden="true"
      >
        <ERPNoticeGlyph tone={tone} />
      </span>
      <div className="ui-inline-notice__body">
        <p className="ui-inline-notice__title">{resolvedTitle}</p>
        {message ? (
          <p className="ui-inline-notice__message">{message}</p>
        ) : null}
        {actions ? (
          <div className="ui-inline-notice__actions">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ERPAlert — dismissible page-level alert banner
// ---------------------------------------------------------------------------

export function ERPAlert({
  tone = "info",
  title,
  message,
  compact = false,
  className = "",
  onDismiss,
  actions,
}: {
  tone?: ERPNotificationTone;
  title?: string;
  message?: ReactNode;
  compact?: boolean;
  className?: string;
  onDismiss?: () => void;
  actions?: ReactNode;
}) {
  const meta = ERP_TONE_META[tone] ?? ERP_TONE_META.info;
  const isAnimating = tone === "loading" || tone === "sync";

  return (
    <div
      className={joinClasses(
        "ui-notice-banner",
        `ui-notice-banner--${tone}`,
        compact && "is-compact",
        className,
      )}
      role={meta.role}
      aria-live={meta.live}
    >
      <span
        className={joinClasses("ui-notice-banner__icon", isAnimating && "is-spinning")}
        aria-hidden="true"
      >
        <ERPNoticeGlyph tone={tone} />
      </span>
      <div className="ui-notice-banner__copy">
        <strong>{title || meta.title}</strong>
        {message ? <p>{message}</p> : null}
        {actions ? (
          <div className="ui-notice-banner__action">{actions}</div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="ui-notice-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ERPBanner — full-width page-top or section-top system banner (no card radius)
// ---------------------------------------------------------------------------

export function ERPBanner({
  tone = "info",
  title,
  message,
  className = "",
  onDismiss,
  actions,
}: {
  tone?: ERPNotificationTone;
  title?: string;
  message?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  actions?: ReactNode;
}) {
  const meta = ERP_TONE_META[tone] ?? ERP_TONE_META.info;
  const isAnimating = tone === "loading" || tone === "sync";

  return (
    <div
      className={joinClasses("ui-erp-banner", `ui-erp-banner--${tone}`, className)}
      role={meta.role}
      aria-live={meta.live}
    >
      <span
        className={joinClasses("ui-erp-banner__icon", isAnimating && "is-spinning")}
        aria-hidden="true"
      >
        <ERPNoticeGlyph tone={tone} />
      </span>
      <div className="ui-erp-banner__body">
        {title ? <p className="ui-erp-banner__title">{title}</p> : null}
        {message ? <p className="ui-erp-banner__message">{message}</p> : null}
        {actions ? <div className="ui-erp-banner__actions">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="ui-erp-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss banner"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ERPSyncAlert — sync queue status notice
// Maps queue state to the appropriate tone and message automatically.
// ---------------------------------------------------------------------------

export type ERPSyncStatus = "idle" | "pending" | "syncing" | "synced" | "failed";

export function ERPSyncAlert({
  status,
  pendingCount = 0,
  message,
  onRetry,
  compact = false,
  className = "",
}: {
  status: ERPSyncStatus;
  pendingCount?: number;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  if (status === "idle" || status === "synced") return null;

  const tone: ERPNotificationTone =
    status === "failed" ? "error" : status === "syncing" ? "sync" : "warning";

  const defaultMessage =
    status === "syncing"
      ? "Syncing your changes…"
      : status === "failed"
        ? "Some changes could not sync. Check your connection and try again."
        : pendingCount > 0
          ? `${pendingCount} change${pendingCount !== 1 ? "s" : ""} waiting to sync.`
          : "Changes are waiting to sync.";

  return (
    <ERPNotice
      tone={tone}
      message={message || defaultMessage}
      compact={compact}
      className={className}
      actions={
        onRetry && status === "failed" ? (
          <button type="button" className="ui-erp-sync-alert__retry" onClick={onRetry}>
            Retry
          </button>
        ) : undefined
      }
    />
  );
}

// ---------------------------------------------------------------------------
// ERPOfflineNotice — offline status indicator
// Pass the result of useOnlineStatus() from @faako/offline-sync as the `offline` prop.
// Returns null when the user is online so it disappears automatically.
// ---------------------------------------------------------------------------

export function ERPOfflineNotice({
  offline,
  message = "You're offline. Some features may be unavailable.",
  compact = false,
  className = "",
}: {
  offline: boolean;
  message?: string;
  compact?: boolean;
  className?: string;
}) {
  if (!offline) return null;
  return (
    <ERPNotice
      tone="offline"
      message={message}
      compact={compact}
      className={className}
    />
  );
}

// ---------------------------------------------------------------------------
// Maintenance/read-only/degraded foundations
// Presentation-only wrappers. Backend/API enforcement still belongs to apps.
// ---------------------------------------------------------------------------

export function ERPMaintenanceBanner({
  title = "Maintenance mode",
  message = "Some features may be temporarily unavailable while maintenance is in progress.",
  className = "",
  onDismiss,
  actions,
}: {
  title?: string;
  message?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  actions?: ReactNode;
}) {
  return (
    <ERPBanner
      tone="maintenance"
      title={title}
      message={message}
      className={className}
      onDismiss={onDismiss}
      actions={actions}
    />
  );
}

export function ERPReadOnlyNotice({
  title = "Read-only mode",
  message = "You can view data, but saving changes may be unavailable until normal service resumes.",
  compact = false,
  className = "",
  actions,
}: {
  title?: string;
  message?: ReactNode;
  compact?: boolean;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <ERPNotice
      tone="maintenance"
      title={title}
      message={message}
      compact={compact}
      className={className}
      actions={actions}
    />
  );
}

export function ERPDegradedNotice({
  title = "Limited service",
  message = "Some services are slower or unavailable. Server validation remains required before changes are final.",
  compact = false,
  className = "",
  actions,
}: {
  title?: string;
  message?: ReactNode;
  compact?: boolean;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <ERPNotice
      tone="degraded"
      title={title}
      message={message}
      compact={compact}
      className={className}
      actions={actions}
    />
  );
}

export function ERPMaintenancePage({
  title = "Maintenance mode",
  message = "This workspace is temporarily unavailable while maintenance is in progress.",
  className = "",
  children,
  actions,
}: {
  title?: string;
  message?: ReactNode;
  className?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={joinClasses("ui-erp-maintenance-page", className)}
      role="region"
      aria-label={title}
    >
      <div className="ui-erp-maintenance-page__inner">
        <ERPNotice tone="maintenance" title={title} message={message} actions={actions} />
        {children ? (
          <div className="ui-erp-maintenance-page__content">{children}</div>
        ) : null}
      </div>
    </section>
  );
}

type AppModeBannerProps = {
  tone?: ERPNotificationTone;
  title?: string;
  message?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  actions?: ReactNode;
};

type AppModeNoticeProps = AppModeBannerProps & {
  compact?: boolean;
};

function AppModeBanner({
  tone = "maintenance",
  title,
  message,
  className = "",
  onDismiss,
  actions,
}: AppModeBannerProps) {
  const meta = ERP_TONE_META[tone] ?? ERP_TONE_META.info;
  const isAnimating = tone === "loading" || tone === "sync";

  return (
    <div
      className={joinClasses("ui-app-mode-banner", `ui-app-mode-banner--${tone}`, className)}
      role={meta.role}
      aria-live={meta.live}
    >
      <span
        className={joinClasses("ui-app-mode-banner__icon", isAnimating && "is-spinning")}
        aria-hidden="true"
      >
        <ERPNoticeGlyph tone={tone} />
      </span>
      <div className="ui-app-mode-banner__body">
        {title ? <p className="ui-app-mode-banner__title">{title}</p> : null}
        {message ? <p className="ui-app-mode-banner__message">{message}</p> : null}
        {actions ? <div className="ui-app-mode-banner__actions">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="ui-app-mode-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss banner"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function AppModeNotice({
  tone = "degraded",
  title,
  message,
  compact = false,
  className = "",
  actions,
}: AppModeNoticeProps) {
  const meta = ERP_TONE_META[tone] ?? ERP_TONE_META.info;
  const resolvedTitle = title || meta.title;
  const isAnimating = tone === "loading" || tone === "sync";

  return (
    <div
      className={joinClasses(
        "ui-app-mode-notice",
        `ui-app-mode-notice--${tone}`,
        compact && "is-compact",
        className,
      )}
      role={meta.role}
      aria-live={meta.live}
    >
      <span
        className={joinClasses("ui-app-mode-notice__icon", isAnimating && "is-spinning")}
        aria-hidden="true"
      >
        <ERPNoticeGlyph tone={tone} />
      </span>
      <div className="ui-app-mode-notice__body">
        <p className="ui-app-mode-notice__title">{resolvedTitle}</p>
        {message ? <p className="ui-app-mode-notice__message">{message}</p> : null}
        {actions ? <div className="ui-app-mode-notice__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function MaintenanceBanner({
  title = "Maintenance mode",
  message = "Some features may be temporarily unavailable while maintenance is in progress.",
  className = "",
  onDismiss,
  actions,
}: Omit<AppModeBannerProps, "tone">) {
  return (
    <AppModeBanner
      tone="maintenance"
      title={title}
      message={message}
      className={className}
      onDismiss={onDismiss}
      actions={actions}
    />
  );
}

export function ReadOnlyModeBanner({
  title = "Read-only mode",
  message = "Viewing is available, but data entry should be avoided until normal service resumes.",
  className = "",
  onDismiss,
  actions,
}: {
  title?: string;
  message?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  actions?: ReactNode;
}) {
  return (
    <AppModeBanner
      tone="maintenance"
      title={title}
      message={message}
      className={className}
      onDismiss={onDismiss}
      actions={actions}
    />
  );
}

export function DegradedModeNotice({
  title = "Limited service",
  message = "Some services are slower or unavailable. Server validation remains required before changes are final.",
  compact = false,
  className = "",
  actions,
}: Omit<AppModeNoticeProps, "tone">) {
  return (
    <AppModeNotice
      tone="degraded"
      title={title}
      message={message}
      compact={compact}
      className={className}
      actions={actions}
    />
  );
}

export function MaintenancePage({
  title = "Maintenance mode",
  message = "This app is temporarily unavailable while maintenance is in progress.",
  className = "",
  children,
  actions,
}: {
  title?: string;
  message?: ReactNode;
  className?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={joinClasses("ui-app-maintenance-page", className)}
      role="region"
      aria-label={title}
    >
      <div className="ui-app-maintenance-page__inner">
        <AppModeNotice tone="maintenance" title={title} message={message} actions={actions} />
        {children ? (
          <div className="ui-app-maintenance-page__content">{children}</div>
        ) : null}
      </div>
    </section>
  );
}

export function MaintenanceGuard({
  mode = "normal",
  children,
  className = "",
  maintenanceFallback,
  maintenanceTitle = "Maintenance mode",
  maintenanceMessage = "This app is temporarily limited while maintenance is in progress.",
  readOnlyMessage,
  degradedMessage,
}: {
  mode?: "normal" | "degraded" | "read_only" | "maintenance" | string;
  children: ReactNode;
  className?: string;
  maintenanceFallback?: ReactNode;
  maintenanceTitle?: string;
  maintenanceMessage?: ReactNode;
  readOnlyMessage?: ReactNode;
  degradedMessage?: ReactNode;
}) {
  const normalizedMode = String(mode || "normal").toLowerCase().replace(/-/g, "_");

  if (normalizedMode === "maintenance") {
    return maintenanceFallback ? (
      <>{maintenanceFallback}</>
    ) : (
      <MaintenancePage title={maintenanceTitle} message={maintenanceMessage} />
    );
  }

  return (
    <div
      className={joinClasses("ui-app-mode-guard", `ui-app-mode-guard--${normalizedMode}`, className)}
      data-app-mode={normalizedMode}
    >
      {normalizedMode === "read_only" ? (
        <ReadOnlyModeBanner message={readOnlyMessage} />
      ) : null}
      {normalizedMode === "degraded" ? (
        <DegradedModeNotice message={degradedMessage} />
      ) : null}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ERPToastStack — standalone stack for apps that need imperative toast control
// without the full ERPToastProvider context tree.
// (ERPToastProvider and useERPToast are re-exported above from Feedback.tsx.)
// ---------------------------------------------------------------------------

type ERPToastRecord = {
  id: string;
  tone: ERPNotificationTone;
  title: string;
  message: string;
  durationMs?: number;
};

export function ERPToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ERPToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="ui-toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={joinClasses("ui-toast", `ui-toast--${toast.tone}`)}
          role="status"
        >
          <span
            className={joinClasses(
              "ui-toast__icon",
              (toast.tone === "loading" || toast.tone === "sync") && "is-spinning",
            )}
            aria-hidden="true"
          >
            <ERPNoticeGlyph tone={toast.tone} />
          </span>
          <div className="ui-toast__copy">
            <strong>{toast.title || ERP_TONE_META[toast.tone]?.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
          <button
            type="button"
            className="ui-toast__dismiss"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function useERPToastStack(defaultDurationMs = 4200) {
  const [toasts, setToasts] = useState<ERPToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ERPToastRecord, "id"> & { id?: string }) => {
      const id = item.id ?? `erp-toast-${Date.now()}-${Math.round(Math.random() * 100000)}`;
      setToasts((prev) => [...prev, { ...item, id }]);
      return id;
    },
    [],
  );

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts
      .filter((t) => t.tone !== "loading" && t.tone !== "sync")
      .map((t) =>
        window.setTimeout(() => dismiss(t.id), t.durationMs ?? defaultDurationMs),
      );
    return () => timers.forEach(clearTimeout);
  }, [defaultDurationMs, dismiss, toasts]);

  return useMemo(() => ({ toasts, push, dismiss }), [dismiss, push, toasts]);
}
