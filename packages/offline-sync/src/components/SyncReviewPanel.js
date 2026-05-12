import React from "react";
import { buildQueueSummary } from "../status/queueSummary.js";
import { SyncConflictCard } from "./SyncConflictCard.js";

const panelStyle = {
  border: "1px solid var(--border, rgba(0,0,0,0.12))",
  borderRadius: "0.75rem",
  padding: "1rem",
  display: "grid",
  gap: "1rem",
  background: "var(--surface, rgba(255,255,255,0.82))",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const chipStyle = {
  border: "1px solid var(--border, rgba(0,0,0,0.14))",
  borderRadius: "999px",
  padding: "0.3rem 0.58rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  color: "var(--muted, rgba(0,0,0,0.68))",
};

const buttonStyle = {
  border: "1px solid var(--border, rgba(0,0,0,0.16))",
  borderRadius: "999px",
  background: "var(--surface, #fff)",
  color: "var(--ink, inherit)",
  cursor: "pointer",
  font: "inherit",
  fontSize: "0.85rem",
  fontWeight: 700,
  padding: "0.46rem 0.8rem",
};

const mutedStyle = {
  margin: 0,
  color: "var(--muted, rgba(0,0,0,0.62))",
  fontSize: "0.9rem",
};

const errorStyle = {
  border: "1px solid rgba(155, 28, 49, 0.25)",
  borderRadius: "0.65rem",
  margin: 0,
  padding: "0.75rem",
  color: "var(--danger, #9b1c31)",
  background: "rgba(155, 28, 49, 0.08)",
};

const buildSummary = ({ summary, items }) => {
  if (summary?.counts && Array.isArray(summary.reviewItems)) return summary;
  return buildQueueSummary(items);
};

export function SyncReviewPanel({
  items = [],
  summary,
  loading = false,
  error = "",
  title = "Offline sync review",
  description = "Review local queued work that needs sync, retry, or operator attention.",
  emptyMessage = "No pending, failed, or conflicting offline actions need review.",
  onRefresh,
  onRetry,
  onCancel,
  onResolve,
  retryingId = "",
  cancellingId = "",
  resolvingId = "",
  className = "",
  style,
}) {
  const queueSummary = buildSummary({ summary, items });
  const counts = queueSummary.counts || {};
  const reviewItems = queueSummary.reviewItems || [];
  const chips = [
    ["Pending", counts.pending],
    ["Syncing", counts.syncing],
    ["Failed", counts.failed],
    ["Conflicts", counts.conflict],
    ["Needs review", counts.needsReview],
    ["Retrying", counts.retrying],
    ["Synced", counts.synced],
    ["Cancelled", counts.cancelled],
    ["Resolved", counts.resolved],
  ].filter(([, value]) => Number(value || 0) > 0);

  return React.createElement(
    "section",
    {
      className: ["sync-review-panel", className].filter(Boolean).join(" "),
      style: { ...panelStyle, ...style },
    },
    React.createElement(
      "div",
      { style: headerStyle },
      React.createElement(
        "div",
        null,
        React.createElement("h2", { style: { margin: 0 } }, title),
        React.createElement("p", { style: mutedStyle }, description)
      ),
      onRefresh
        ? React.createElement(
            "button",
            { type: "button", style: buttonStyle, onClick: onRefresh, disabled: loading },
            loading ? "Refreshing..." : "Refresh"
          )
        : null
    ),
    React.createElement(
      "div",
      { style: chipRowStyle, "aria-label": "Offline sync queue counts" },
      chips.length
        ? chips.map(([label, value]) =>
            React.createElement("span", { key: label, style: chipStyle }, `${label}: ${value}`)
          )
        : React.createElement("span", { style: chipStyle }, "Queue clear")
    ),
    error ? React.createElement("p", { style: errorStyle }, String(error)) : null,
    !loading && !reviewItems.length ? React.createElement("p", { style: mutedStyle }, emptyMessage) : null,
    reviewItems.length
      ? React.createElement(
          "div",
          { style: { display: "grid", gap: "0.75rem" } },
          reviewItems.map((item) =>
            React.createElement(SyncConflictCard, {
              key: item.id,
              item,
              onRetry,
              onCancel,
              onResolve,
              retrying: retryingId === item.id,
              cancelling: cancellingId === item.id,
              resolving: resolvingId === item.id,
            })
          )
        )
      : null
  );
}
