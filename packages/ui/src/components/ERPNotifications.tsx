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

  if (tone === "warning") {
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

  if (tone === "sync") {
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
