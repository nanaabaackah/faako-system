import React from "react";
import { formatDateTime } from "../../utils/formatters";
import "./TerminalLogStream.css";

const LEVEL_ALIASES = {
  danger: "error",
  urgent: "error",
  warn: "warning",
  normal: "info",
  neutral: "info",
  success: "success",
};

const normalizeLevel = (level) => {
  const normalized = String(level || "info").trim().toLowerCase();
  return LEVEL_ALIASES[normalized] || normalized || "info";
};

const formatMetadata = (metadata) => {
  if (!metadata) return "";
  if (typeof metadata === "string") return metadata;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
};

const TerminalLogStream = ({
  entries = [],
  className = "",
  emptyMessage = "No logs yet.",
  isLive = false,
  isRefreshing = false,
  lastUpdatedAt = "",
  ariaLabel = "Terminal log stream",
}) => {
  const rows = Array.isArray(entries) ? entries : [];
  const lastUpdatedLabel = lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "";

  return (
    <div
      className={`glass-card terminal-log-stream ${className}`.trim()}
      role="log"
      aria-live={isLive ? "polite" : "off"}
      aria-label={ariaLabel}
    >
      <div className="terminal-log-stream__chrome" aria-hidden="true">
        <span className="terminal-log-stream__dot is-red" />
        <span className="terminal-log-stream__dot is-yellow" />
        <span className="terminal-log-stream__dot is-green" />
        <span className="terminal-log-stream__title">Logs</span>
        {isLive ? (
          <span className={`terminal-log-stream__live ${isRefreshing ? "is-refreshing" : ""}`}>
            {isRefreshing ? "syncing" : "live"}
          </span>
        ) : null}
      </div>
      {lastUpdatedLabel ? (
        <div className="terminal-log-stream__sync">last update {lastUpdatedLabel}</div>
      ) : null}
      <div className="terminal-log-stream__body">
        {rows.length ? (
          rows.map((entry) => {
            const level = normalizeLevel(entry.level);
            const metadata = formatMetadata(entry.metadata);
            return (
              <article className={`terminal-log-row is-${level}`} key={entry.id}>
                <span className="terminal-log-row__prompt" aria-hidden="true">
                  $
                </span>
                <time className="terminal-log-row__time" dateTime={entry.timestamp || ""}>
                  {entry.timestamp ? formatDateTime(entry.timestamp) : "N/A"}
                </time>
                <span className={`terminal-log-row__level is-${level}`}>{level}</span>
                <span className="terminal-log-row__source">{entry.source || "system"}</span>
                <span className="terminal-log-row__message">
                  {entry.message || entry.action || "Log event"}
                </span>
                {entry.detail ? (
                  <span className="terminal-log-row__detail">{entry.detail}</span>
                ) : null}
                {metadata ? (
                  <pre className="terminal-log-row__metadata">{metadata}</pre>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="terminal-log-stream__empty">
            <span className="terminal-log-row__prompt" aria-hidden="true">
              $
            </span>
            <span>{emptyMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalLogStream;
