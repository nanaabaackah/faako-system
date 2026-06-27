import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { FeedbackItem, FeedbackTone, SecurityStateId } from "@faako/types";
import { Button } from "./Primitives";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const NOTICE_META: Record<
  FeedbackTone,
  { title: string; role: "status" | "alert"; live: "polite" | "assertive" }
> = {
  success: {
    title: "Saved successfully",
    role: "status",
    live: "polite",
  },
  error: {
    title: "Action needed",
    role: "alert",
    live: "assertive",
  },
  warning: {
    title: "Check this step",
    role: "alert",
    live: "assertive",
  },
  info: {
    title: "Heads up",
    role: "status",
    live: "polite",
  },
  loading: {
    title: "Working on it",
    role: "status",
    live: "polite",
  },
};

const SECURITY_STATE_META: Record<
  SecurityStateId,
  { tone: FeedbackTone; title: string; message: string }
> = {
  "session-expired": {
    tone: "warning",
    title: "Session expired",
    message: "Please sign in again to continue your work.",
  },
  unauthorized: {
    tone: "error",
    title: "Unauthorized",
    message: "You need to sign in before continuing to this page.",
  },
  forbidden: {
    tone: "error",
    title: "Access blocked",
    message: "Your account does not have permission to do that.",
  },
  "rate-limited": {
    tone: "warning",
    title: "Too many requests",
    message: "Please slow down and try the action again in a moment.",
  },
  "blocked-action": {
    tone: "warning",
    title: "Action blocked",
    message: "A security rule stopped this action before it changed anything.",
  },
  "verification-sent": {
    tone: "success",
    title: "Verification sent",
    message: "Check your inbox for the next step.",
  },
  "password-reset-required": {
    tone: "info",
    title: "Password reset required",
    message: "Reset your password before using this protected area again.",
  },
  "secure-download-failed": {
    tone: "error",
    title: "Secure download failed",
    message: "We could not verify the file request. Refresh and try again.",
  },
};

const FeedbackGlyph = ({ tone }: { tone: FeedbackTone }) => {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.8 10.2L9.2 12.6L13.4 7.8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7.2 7.2L12.8 12.8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12.8 7.2L7.2 12.8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (tone === "warning") {
    return (
      <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
        <path d="M10 3.5L17 15.5H3L10 3.5Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M10 7.4V10.6" stroke="currentColor" strokeWidth="1.8" />
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

  return (
    <svg viewBox="0 0 20 20" fill="none" focusable="false" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 8V12.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="6.2" r="0.8" fill="currentColor" />
    </svg>
  );
};

type LoadingLayoutVariant =
  | "api"
  | "commerce"
  | "dashboard"
  | "detail"
  | "portfolio"
  | "portal"
  | "storefront"
  | "workspace";

const inferLoadingVariant = (title: string): LoadingLayoutVariant => {
  const value = title.toLowerCase();

  if (value.includes("api") || value.includes("health")) return "api";
  if (value.includes("portfolio")) return "portfolio";
  if (value.includes("detail") || value.includes("product") || value.includes("rental")) return "detail";
  if (value.includes("portal") || value.includes("admin") || value.includes("access")) return "portal";
  if (
    value.includes("dashboard") ||
    value.includes("erp") ||
    value.includes("workspace") ||
    value.includes("report") ||
    value.includes("invoice") ||
    value.includes("audit") ||
    value.includes("account")
  ) {
    return "dashboard";
  }

  return "storefront";
};

const skeletonCards = (count: number) =>
  Array.from({ length: count }).map((_, index) => (
    <span className="ui-animated-loading-state__skeleton-card" key={index}>
      <i className="is-media" />
      <i />
      <i />
    </span>
  ));

const skeletonTableRows = (count: number) =>
  Array.from({ length: count }).map((_, index) => (
    <span className="ui-animated-loading-state__skeleton-table-row" key={index}>
      <i />
      <i />
      <i />
      <i />
    </span>
  ));

const CommercePageSkeleton = ({ variant }: { variant: LoadingLayoutVariant }) => (
  <div className="ui-animated-loading-state__page-skeleton" data-layout={variant} aria-hidden="true">
    <div className="ui-animated-loading-state__skeleton-topbar">
      <span className="ui-animated-loading-state__skeleton-mark" />
      <span className="ui-animated-loading-state__skeleton-line is-title" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line is-action" />
    </div>
    <div className="ui-animated-loading-state__skeleton-hero">
      <div className="ui-animated-loading-state__skeleton-hero-copy">
        <span className="ui-animated-loading-state__skeleton-line is-kicker" />
        <span className="ui-animated-loading-state__skeleton-line is-heading" />
        <span className="ui-animated-loading-state__skeleton-line is-body" />
        <span className="ui-animated-loading-state__skeleton-line is-body is-short" />
        <span className="ui-animated-loading-state__skeleton-line is-button" />
      </div>
      <span className="ui-animated-loading-state__skeleton-media" />
    </div>
    <div className="ui-animated-loading-state__skeleton-toolbar">
      <span />
      <span />
      <span />
    </div>
    <div className="ui-animated-loading-state__skeleton-card-grid">
      {skeletonCards(variant === "portfolio" ? 4 : 6)}
    </div>
  </div>
);

const DetailPageSkeleton = () => (
  <div className="ui-animated-loading-state__page-skeleton" data-layout="detail" aria-hidden="true">
    <div className="ui-animated-loading-state__skeleton-topbar">
      <span className="ui-animated-loading-state__skeleton-mark" />
      <span className="ui-animated-loading-state__skeleton-line is-title" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line is-action" />
    </div>
    <div className="ui-animated-loading-state__skeleton-detail">
      <div className="ui-animated-loading-state__skeleton-gallery">
        <span className="ui-animated-loading-state__skeleton-media" />
        <div className="ui-animated-loading-state__skeleton-toolbar">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="ui-animated-loading-state__skeleton-detail-copy">
        <span className="ui-animated-loading-state__skeleton-line is-kicker" />
        <span className="ui-animated-loading-state__skeleton-line is-heading" />
        <span className="ui-animated-loading-state__skeleton-line is-body" />
        <span className="ui-animated-loading-state__skeleton-line is-body" />
        <span className="ui-animated-loading-state__skeleton-line is-body is-short" />
        <div className="ui-animated-loading-state__skeleton-metrics">
          <span />
          <span />
          <span />
        </div>
        <span className="ui-animated-loading-state__skeleton-line is-button" />
      </div>
    </div>
    <div className="ui-animated-loading-state__skeleton-card-grid is-recommendations">
      {skeletonCards(4)}
    </div>
  </div>
);

const PortalPageSkeleton = ({ variant }: { variant: LoadingLayoutVariant }) => (
  <div className="ui-animated-loading-state__page-skeleton" data-layout={variant} aria-hidden="true">
    <aside className="ui-animated-loading-state__skeleton-sidebar">
      <span className="ui-animated-loading-state__skeleton-mark" />
      <span className="ui-animated-loading-state__skeleton-line is-title" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line is-action" />
    </aside>
    <main className="ui-animated-loading-state__skeleton-main">
      <div className="ui-animated-loading-state__skeleton-topbar">
        <span className="ui-animated-loading-state__skeleton-line is-title" />
        <span className="ui-animated-loading-state__skeleton-line" />
        <span className="ui-animated-loading-state__skeleton-line is-action" />
      </div>
      <div className="ui-animated-loading-state__skeleton-metrics">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="ui-animated-loading-state__skeleton-panel-grid">
        <section className="ui-animated-loading-state__skeleton-panel is-table">
          <span className="ui-animated-loading-state__skeleton-line is-title" />
          <div className="ui-animated-loading-state__skeleton-table">
            {skeletonTableRows(5)}
          </div>
        </section>
        <section className="ui-animated-loading-state__skeleton-panel">
          <span className="ui-animated-loading-state__skeleton-line is-title" />
          <span className="ui-animated-loading-state__skeleton-media" />
          <span className="ui-animated-loading-state__skeleton-line is-body" />
          <span className="ui-animated-loading-state__skeleton-line is-body is-short" />
        </section>
      </div>
    </main>
  </div>
);

const WorkspacePageSkeleton = () => (
  <div className="ui-animated-loading-state__page-skeleton" data-layout="workspace" aria-hidden="true">
    <div className="ui-animated-loading-state__skeleton-topbar">
      <span className="ui-animated-loading-state__skeleton-mark" />
      <span className="ui-animated-loading-state__skeleton-line is-title" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line is-action" />
    </div>
    <div className="ui-animated-loading-state__skeleton-workspace">
      <section className="ui-animated-loading-state__skeleton-panel is-table">
        <span className="ui-animated-loading-state__skeleton-line is-title" />
        <div className="ui-animated-loading-state__skeleton-table">{skeletonTableRows(6)}</div>
      </section>
      <section className="ui-animated-loading-state__skeleton-panel is-table">
        <span className="ui-animated-loading-state__skeleton-line is-title" />
        <div className="ui-animated-loading-state__skeleton-table">{skeletonTableRows(5)}</div>
      </section>
      <section className="ui-animated-loading-state__skeleton-panel">
        <span className="ui-animated-loading-state__skeleton-line is-title" />
        <span className="ui-animated-loading-state__skeleton-media" />
        <span className="ui-animated-loading-state__skeleton-line is-body" />
        <span className="ui-animated-loading-state__skeleton-line is-body is-short" />
      </section>
    </div>
  </div>
);

const ApiPageSkeleton = () => (
  <div className="ui-animated-loading-state__page-skeleton" data-layout="api" aria-hidden="true">
    <div className="ui-animated-loading-state__skeleton-topbar">
      <span className="ui-animated-loading-state__skeleton-mark" />
      <span className="ui-animated-loading-state__skeleton-line is-title" />
      <span className="ui-animated-loading-state__skeleton-line" />
      <span className="ui-animated-loading-state__skeleton-line is-action" />
    </div>
    <div className="ui-animated-loading-state__skeleton-api">
      <section className="ui-animated-loading-state__skeleton-panel is-table">
        <span className="ui-animated-loading-state__skeleton-line is-title" />
        <div className="ui-animated-loading-state__skeleton-table">{skeletonTableRows(7)}</div>
      </section>
      <section className="ui-animated-loading-state__skeleton-console">
        <span className="ui-animated-loading-state__skeleton-line is-title" />
        <i />
        <i />
        <i />
        <i />
        <i />
      </section>
    </div>
  </div>
);

const PageSkeleton = ({ variant }: { variant: LoadingLayoutVariant }) => {
  if (variant === "portal" || variant === "dashboard") return <PortalPageSkeleton variant={variant} />;
  if (variant === "workspace") return <WorkspacePageSkeleton />;
  if (variant === "api") return <ApiPageSkeleton />;
  if (variant === "detail") return <DetailPageSkeleton />;
  return <CommercePageSkeleton variant={variant} />;
};

export function AnimatedLoadingState({
  title = "Loading",
  message = "Pulling the latest information.",
  compact = false,
  page = false,
  overlay = false,
  className = "",
  variant,
}: {
  title?: string;
  message?: ReactNode;
  compact?: boolean;
  page?: boolean;
  overlay?: boolean;
  className?: string;
  variant?: LoadingLayoutVariant;
}) {
  const resolvedVariant = variant || inferLoadingVariant(title);
  const skeleton = page ? (
    <PageSkeleton variant={resolvedVariant} />
  ) : (
    <div className="ui-animated-loading-state__skeleton" aria-hidden="true">
      <div className="ui-animated-loading-state__skeleton-head">
        <span className="ui-animated-loading-state__skeleton-mark" />
        <span className="ui-animated-loading-state__skeleton-line is-title" />
        <span className="ui-animated-loading-state__skeleton-line is-action" />
      </div>
      <div className="ui-animated-loading-state__skeleton-metrics">
        <span />
        <span />
        <span />
      </div>
      <div className="ui-animated-loading-state__skeleton-rows">
        <span><i /><i /><i /></span>
        <span><i /><i /><i /></span>
        <span><i /><i /><i /></span>
      </div>
    </div>
  );

  return (
    <div
      className={joinClasses(
        "ui-animated-loading-state",
        compact && "is-compact",
        page && "is-page",
        overlay && "is-overlay",
        page && `is-${resolvedVariant}-layout`,
        className,
      )}
      data-layout={page ? resolvedVariant : undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {skeleton}
      <span className="ui-animated-loading-state__copy">
        <strong>{title}</strong>
        {message ? <span>{message}</span> : null}
      </span>
    </div>
  );
}

export function InlineNotice({
  tone = "info",
  title,
  message = "",
  className = "",
  compact = false,
  renderIcon,
  iconClassName = "",
  bodyClassName = "",
  titleClassName = "",
  messageClassName = "",
  dismissible,
  onDismiss,
  dismissLabel = "Clear",
}: {
  tone?: FeedbackTone;
  title?: string;
  message?: ReactNode;
  className?: string;
  compact?: boolean;
  renderIcon?: (tone: FeedbackTone) => ReactNode;
  iconClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
  messageClassName?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const meta = NOTICE_META[tone] || NOTICE_META.info;
  const resolvedTitle = title || meta.title;
  const [dismissed, setDismissed] = useState(false);
  const canDismiss = dismissible ?? tone !== "loading";

  useEffect(() => {
    setDismissed(false);
  }, [message, title, tone]);

  if (dismissed) return null;

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
      return;
    }
    setDismissed(true);
  };

  return (
    <div
      className={joinClasses(
        "ui-inline-notice",
        `ui-inline-notice--${tone}`,
        compact && "is-compact",
        canDismiss && "is-dismissible",
        className,
      )}
      role={meta.role}
      aria-live={meta.live}
    >
      <span
        className={joinClasses(
          "ui-inline-notice__icon",
          tone === "loading" && "is-spinning",
          iconClassName,
        )}
        aria-hidden="true"
      >
        {renderIcon ? renderIcon(tone) : <FeedbackGlyph tone={tone} />}
      </span>
      <div className={joinClasses("ui-inline-notice__body", bodyClassName)}>
        <p className={joinClasses("ui-inline-notice__title", titleClassName)}>{resolvedTitle}</p>
        {message ? (
          <p className={joinClasses("ui-inline-notice__message", messageClassName)}>{message}</p>
        ) : null}
      </div>
      {canDismiss ? (
        <button
          type="button"
          className="ui-inline-notice__dismiss"
          onClick={handleDismiss}
          aria-label={dismissLabel}
        >
          {dismissLabel}
        </button>
      ) : null}
    </div>
  );
}

export function InlineNoticeStack({
  notices = [],
  className = "",
  compact = false,
}: {
  notices?: Array<FeedbackItem | null | undefined>;
  className?: string;
  compact?: boolean;
}) {
  const safeNotices = Array.isArray(notices) ? notices.filter(Boolean) : [];
  if (!safeNotices.length) return null;

  return (
    <div className={joinClasses("ui-inline-notice-stack", className)}>
      {safeNotices.map((notice, index) => (
        <InlineNotice
          key={notice?.id || `${notice?.tone || "info"}-${index}`}
          tone={notice?.tone}
          title={notice?.title}
          message={notice?.message}
          compact={compact}
        />
      ))}
    </div>
  );
}

export function NoticeBanner({
  tone = "info",
  title,
  message = "",
  className = "",
  onDismiss,
  action = null,
}: {
  tone?: FeedbackTone;
  title?: string;
  message?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  action?: ReactNode;
}) {
  const meta = NOTICE_META[tone] || NOTICE_META.info;
  return (
    <div
      className={joinClasses("ui-notice-banner", `ui-notice-banner--${tone}`, className)}
      role={meta.role}
      aria-live={meta.live}
    >
      <span className={joinClasses("ui-notice-banner__icon", tone === "loading" && "is-spinning")} aria-hidden="true">
        <FeedbackGlyph tone={tone} />
      </span>
      <div className="ui-notice-banner__copy">
        <strong>{title || meta.title}</strong>
        {message ? <p>{message}</p> : null}
      </div>
      {action ? <div className="ui-notice-banner__action">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          className="ui-notice-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss notice"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

type ToastRecord = Required<Pick<FeedbackItem, "id" | "tone" | "title" | "message">> & {
  durationMs?: number;
};

const ToastContext = createContext<{
  pushToast: (item: FeedbackItem) => string;
  dismissToast: (id: string) => void;
}>({
  pushToast: () => "",
  dismissToast: () => {},
});

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="ui-toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={joinClasses("ui-toast", `ui-toast--${toast.tone}`)} role="status">
          <span className={joinClasses("ui-toast__icon", toast.tone === "loading" && "is-spinning")} aria-hidden="true">
            <FeedbackGlyph tone={toast.tone} />
          </span>
          <div className="ui-toast__copy">
            <strong>{toast.title || NOTICE_META[toast.tone].title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
          <button type="button" className="ui-toast__dismiss" onClick={() => onDismiss(toast.id)} aria-label="Dismiss toast">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({
  children,
  defaultDurationMs = 4200,
}: PropsWithChildren<{ defaultDurationMs?: number }>) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (item: FeedbackItem) => {
      const id = item.id || `toast-${Date.now()}-${Math.round(Math.random() * 100000)}`;
      const nextToast: ToastRecord = {
        id,
        tone: item.tone || "info",
        title: item.title || "",
        message: String(item.message || ""),
        durationMs: item.durationMs,
      };
      setToasts((current) => [...current, nextToast]);
      return id;
    },
    [],
  );

  useEffect(() => {
    if (!toasts.length) return undefined;

    const timers = toasts
      .filter((toast) => toast.tone !== "loading")
      .map((toast) =>
        window.setTimeout(
          () => dismissToast(toast.id),
          toast.durationMs ?? defaultDurationMs,
        ),
      );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [defaultDurationMs, dismissToast, toasts]);

  const contextValue = useMemo(
    () => ({
      pushToast,
      dismissToast,
    }),
    [dismissToast, pushToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(<ToastViewport toasts={toasts} onDismiss={dismissToast} />, document.body)
        : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function SecurityState({
  stateId,
  title,
  message,
  compact = false,
  actions = null,
}: {
  stateId: SecurityStateId;
  title?: string;
  message?: string;
  compact?: boolean;
  actions?: ReactNode;
}) {
  const meta = SECURITY_STATE_META[stateId];
  if (!meta) return null;

  if (compact) {
    return (
      <div className="ui-security-state">
        <InlineNotice
          tone={meta.tone}
          title={title || meta.title}
          message={message || meta.message}
          compact
        />
        {actions ? <div className="ui-security-state__actions">{actions}</div> : null}
      </div>
    );
  }

  return (
    <div className="ui-security-state">
      <NoticeBanner
        tone={meta.tone}
        title={title || meta.title}
        message={message || meta.message}
        action={actions}
      />
    </div>
  );
}

export function SecurityActionButton({
  children,
  ...props
}: PropsWithChildren<{ onClick?: () => void }>) {
  return (
    <Button variant="secondary" {...props}>
      {children}
    </Button>
  );
}
