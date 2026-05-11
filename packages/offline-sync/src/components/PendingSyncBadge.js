import React from "react";
import { SYNC_STATES } from "../constants/syncStates.js";

export function PendingSyncBadge({
  count = 0,
  label = "Pending sync",
  className = "",
  style,
  ...props
}) {
  const pendingCount = Math.max(Number(count || 0), 0);
  if (pendingCount <= 0) return null;

  return React.createElement(
    "span",
    {
      className: ["pending-sync-badge", className].filter(Boolean).join(" "),
      "data-sync-state": SYNC_STATES.PENDING,
      role: "status",
      style: {
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        padding: "0.24rem 0.55rem",
        fontSize: "0.76rem",
        fontWeight: 700,
        background: "var(--warning-soft, rgba(138, 90, 0, 0.16))",
        color: "var(--warning, #8a5a00)",
        ...style,
      },
      ...props,
    },
    `${pendingCount} ${label}`
  );
}
