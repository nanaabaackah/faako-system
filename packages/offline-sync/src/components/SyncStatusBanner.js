import React from "react";
import { SYNC_STATES, SYNC_STATE_LABELS } from "../constants/syncStates.js";
import { useSyncStatus } from "../hooks/useSyncStatus.js";

export function SyncStatusBanner({
  pendingCount = 0,
  failedCount = 0,
  conflictCount = 0,
  syncing = false,
  className = "",
  style,
  children,
  ...props
}) {
  const summary = useSyncStatus({ pendingCount, failedCount, conflictCount, syncing });
  if (summary.status === SYNC_STATES.ONLINE) return null;

  const message =
    children ||
    (summary.status === SYNC_STATES.OFFLINE
      ? "Offline. Changes still require server validation before they can sync."
      : `${SYNC_STATE_LABELS[summary.status]}. ${summary.pendingCount} item(s) waiting for future sync.`);

  return React.createElement(
    "div",
    {
      className: ["sync-status-banner", `sync-status-banner--${summary.status}`, className]
        .filter(Boolean)
        .join(" "),
      "data-sync-state": summary.status,
      role: "status",
      "aria-live": "polite",
      style: {
        border: "1px solid var(--border, rgba(0,0,0,0.16))",
        borderRadius: "0.75rem",
        padding: "0.72rem 0.9rem",
        background: "var(--warning-soft, rgba(138, 90, 0, 0.14))",
        color: "var(--ink, inherit)",
        fontSize: "0.9rem",
        ...style,
      },
      ...props,
    },
    message
  );
}
