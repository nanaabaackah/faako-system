import React from "react";
import { SYNC_STATES, SYNC_STATE_LABELS } from "../constants/syncStates.js";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  border: "1px solid currentColor",
  borderRadius: "999px",
  padding: "0.26rem 0.6rem",
  fontSize: "0.78rem",
  fontWeight: 700,
  lineHeight: 1,
};

const dotStyle = {
  width: "0.48rem",
  height: "0.48rem",
  borderRadius: "999px",
  background: "currentColor",
  flex: "0 0 auto",
};

export function OfflineStatusBadge({
  online,
  showOnline = true,
  onlineLabel = SYNC_STATE_LABELS[SYNC_STATES.ONLINE],
  offlineLabel = SYNC_STATE_LABELS[SYNC_STATES.OFFLINE],
  className = "",
  style,
  ...props
}) {
  const detectedOnline = useOnlineStatus(online);
  if (detectedOnline && !showOnline) return null;

  const status = detectedOnline ? SYNC_STATES.ONLINE : SYNC_STATES.OFFLINE;
  const label = detectedOnline ? onlineLabel : offlineLabel;

  return React.createElement(
    "span",
    {
      className: ["offline-status-badge", `offline-status-badge--${status}`, className]
        .filter(Boolean)
        .join(" "),
      "data-sync-state": status,
      role: "status",
      "aria-live": "polite",
      style: { ...badgeStyle, color: detectedOnline ? "var(--success, #2e7d32)" : "var(--warning, #8a5a00)", ...style },
      ...props,
    },
    React.createElement("span", { "aria-hidden": "true", style: dotStyle }),
    React.createElement("span", null, label)
  );
}
