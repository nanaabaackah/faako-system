import { type CSSProperties, type ReactNode } from "react";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

// ─── Types ────────────────────────────────────────────────────────────────────

export type ERPActivityItemTone =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral";

export interface ERPActivityFeedItem {
  /** Stable key for React reconciliation */
  id: string;
  /** Human-readable action label (e.g. "Offline sync failed") */
  actionLabel: string;
  /** Entity display label (e.g. "Queue item", "Rent payment") */
  entityLabel?: string;
  /** Display-safe actor name (never a raw ID, email, or token) */
  actorLabel?: string;
  /** Human-readable status (e.g. "Failed", "Success") */
  statusLabel?: string;
  /** Visual tone for the timeline dot and badge */
  tone?: ERPActivityItemTone;
  /** Optional extra context line (capped error text, reference label, etc.) */
  detail?: string;
  /** ISO 8601 timestamp */
  timestamp?: string;
  /** Optional navigation href rendered as a link */
  href?: string;
}

interface ERPActivityFeedProps {
  items?: ERPActivityFeedItem[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  /** Tighter vertical spacing for sidebar/widget contexts */
  compact?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  /** Optional class to apply app-specific theming, spacing, or layout overrides */
  className?: string;
  /** Optional inline style; reserve for truly dynamic values (theme tokens belong in className) */
  style?: CSSProperties;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatActivityTimestamp(timestamp?: string): string {
  if (!timestamp) return "";
  const ms = new Date(timestamp).getTime();
  if (Number.isNaN(ms)) return "";
  const diffMs = Date.now() - ms;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ─── Components ───────────────────────────────────────────────────────────────

function ERPActivityDot({ tone }: { tone?: ERPActivityItemTone }) {
  return (
    <span
      className={joinClasses(
        "ui-erp-activity-dot",
        tone ? `ui-erp-activity-dot--${tone}` : "ui-erp-activity-dot--neutral",
      )}
      aria-hidden="true"
    />
  );
}

function ERPActivityItem({ item, isLast }: { item: ERPActivityFeedItem; isLast: boolean }) {
  const timeLabel = formatActivityTimestamp(item.timestamp);
  const metaParts = [item.actorLabel, item.entityLabel].filter(Boolean);

  return (
    <li
      className={joinClasses(
        "ui-erp-activity-item",
        item.tone ? `ui-erp-activity-item--${item.tone}` : undefined,
        isLast && "ui-erp-activity-item--last",
      )}
    >
      <div className="ui-erp-activity-rail" aria-hidden="true">
        <ERPActivityDot tone={item.tone} />
        {!isLast && <span className="ui-erp-activity-rail__line" />}
      </div>
      <div className="ui-erp-activity-body">
        <div className="ui-erp-activity-topline">
          {item.statusLabel ? (
            <span
              className={joinClasses(
                "ui-erp-activity-badge",
                item.tone ? `ui-erp-activity-badge--${item.tone}` : undefined,
              )}
            >
              {item.statusLabel}
            </span>
          ) : null}
          {timeLabel ? (
            <time
              className="ui-erp-activity-time"
              dateTime={item.timestamp}
              title={item.timestamp}
            >
              {timeLabel}
            </time>
          ) : null}
        </div>
        <p className="ui-erp-activity-action">{item.actionLabel}</p>
        {metaParts.length > 0 ? (
          <p className="ui-erp-activity-meta">{metaParts.join(" · ")}</p>
        ) : null}
        {item.detail ? (
          <p className="ui-erp-activity-detail">{item.detail}</p>
        ) : null}
      </div>
    </li>
  );
}

export function ERPActivityFeed({
  items = [],
  loading = false,
  error,
  emptyMessage = "No activity recorded yet.",
  compact = false,
  title,
  description,
  className,
  style,
}: ERPActivityFeedProps) {
  return (
    <div
      className={joinClasses(
        "ui-erp-activity-feed",
        compact && "ui-erp-activity-feed--compact",
        className,
      )}
      style={style}
    >
      {(title || description) ? (
        <div className="ui-erp-activity-feed__header">
          {title ? (
            <p className="ui-erp-activity-feed__title">{title}</p>
          ) : null}
          {description ? (
            <p className="ui-erp-activity-feed__description">{description}</p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="ui-erp-activity-feed__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && items.length === 0 ? (
        <p className="ui-erp-activity-feed__loading" aria-live="polite">
          Loading activity…
        </p>
      ) : items.length > 0 ? (
        <ol
          className="ui-erp-activity-list"
          aria-label="Activity feed"
          aria-live="polite"
          aria-atomic="false"
        >
          {items.map((item, idx) => (
            <ERPActivityItem key={item.id} item={item} isLast={idx === items.length - 1} />
          ))}
        </ol>
      ) : !loading ? (
        <p className="ui-erp-activity-feed__empty">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
