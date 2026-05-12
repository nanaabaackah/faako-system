import React from "react";
import { SYNC_STATES, SYNC_STATE_LABELS } from "../constants/syncStates.js";
import {
  getQueueActionLabel,
  getQueueItemDisplayMeta,
  isQueueItemConflictLike,
} from "../status/queueSummary.js";

const cardStyle = {
  border: "1px solid var(--border, rgba(0,0,0,0.14))",
  borderRadius: "0.75rem",
  padding: "0.9rem",
  display: "grid",
  gap: "0.75rem",
  background: "var(--surface, rgba(255,255,255,0.78))",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  alignItems: "flex-start",
};

const mutedStyle = {
  margin: 0,
  color: "var(--muted, rgba(0,0,0,0.62))",
  fontSize: "0.85rem",
};

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const buttonStyle = {
  border: "1px solid var(--border, rgba(0,0,0,0.16))",
  borderRadius: "999px",
  background: "var(--surface, #fff)",
  color: "var(--ink, inherit)",
  cursor: "pointer",
  font: "inherit",
  fontSize: "0.82rem",
  fontWeight: 700,
  padding: "0.42rem 0.72rem",
};

export function SyncConflictCard({
  item,
  onRetry,
  onCancel,
  onResolve,
  retrying = false,
  cancelling = false,
  resolving = false,
  className = "",
  style,
}) {
  if (!item) return null;
  const meta = getQueueItemDisplayMeta(item);
  const statusLabel = SYNC_STATE_LABELS[item.status] || item.status || "Queued";
  const canRetry = [SYNC_STATES.FAILED, SYNC_STATES.CONFLICT, SYNC_STATES.NEEDS_REVIEW].includes(item.status);
  const canCancel = ![SYNC_STATES.CANCELLED, SYNC_STATES.RESOLVED, SYNC_STATES.SYNCED, SYNC_STATES.SYNCING].includes(item.status);
  const canResolve = isQueueItemConflictLike(item) || item.status === SYNC_STATES.FAILED;

  return React.createElement(
    "article",
    {
      className: ["sync-conflict-card", `sync-conflict-card--${item.status}`, className]
        .filter(Boolean)
        .join(" "),
      "data-sync-state": item.status,
      style: { ...cardStyle, ...style },
    },
    React.createElement(
      "div",
      { style: headerStyle },
      React.createElement(
        "div",
        null,
        React.createElement("strong", null, getQueueActionLabel(item)),
        React.createElement("p", { style: mutedStyle }, meta.title || "Queued offline action")
      ),
      React.createElement("span", { style: { ...mutedStyle, fontWeight: 800 } }, statusLabel)
    ),
    meta.lastError
      ? React.createElement("p", { style: { margin: 0, color: "var(--danger, #9b1c31)" } }, meta.lastError)
      : null,
    React.createElement(
      "div",
      { style: mutedStyle },
      [
        meta.targetType ? `Target: ${meta.targetType}${meta.targetId ? ` #${meta.targetId}` : ""}` : "",
        item.retry?.attempts ? `Retries: ${item.retry.attempts}` : "",
        meta.queuedAt ? `Queued: ${meta.queuedAt}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    ),
    React.createElement(
      "div",
      { style: actionsStyle },
      canRetry && onRetry
        ? React.createElement(
            "button",
            { type: "button", style: buttonStyle, onClick: () => onRetry(item), disabled: retrying },
            retrying ? "Retrying..." : "Retry"
          )
        : null,
      canResolve && onResolve
        ? React.createElement(
            "button",
            { type: "button", style: buttonStyle, onClick: () => onResolve(item), disabled: resolving },
            resolving ? "Resolving..." : "Mark resolved"
          )
        : null,
      canCancel && onCancel
        ? React.createElement(
            "button",
            {
              type: "button",
              style: { ...buttonStyle, color: "var(--danger, #9b1c31)" },
              onClick: () => onCancel(item),
              disabled: cancelling,
            },
            cancelling ? "Cancelling..." : "Cancel"
          )
        : null
    )
  );
}
