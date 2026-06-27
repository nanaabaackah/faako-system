import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatedLoadingState, ERPFormNotice, SelectField } from "@faako/ui";
import "./AdminAuditLogs.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";

const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "auth", label: "Auth" },
  { value: "api", label: "API" },
  { value: "integration", label: "Integration" },
  { value: "railway", label: "Railway" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "access", label: "Access" },
  { value: "inventory", label: "Inventory" },
  { value: "order", label: "Orders" },
  { value: "booking", label: "Bookings" },
  { value: "delivery", label: "Delivery" },
  { value: "document", label: "Documents" },
  { value: "maintenance", label: "Maintenance" },
  { value: "marketing", label: "Marketing" },
  { value: "timesheet", label: "Timesheets" },
  { value: "incident", label: "Incident" },
];

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildQuery = (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    params.set(key, normalized);
  });
  return params.toString();
};

const formatMetadata = (metadata) => {
  if (!metadata) return "—";
  try {
    const summary = JSON.stringify(metadata);
    return summary.length > 140 ? `${summary.slice(0, 140)}...` : summary;
  } catch {
    return "Metadata attached";
  }
};

const getSeverityClass = (severity) => {
  const normalized = String(severity || "info").toLowerCase();
  if (normalized === "error" || normalized === "failed" || normalized === "failure") return "error";
  if (normalized === "warning" || normalized === "warn") return "warning";
  if (normalized === "success" || normalized === "ok") return "success";
  return "info";
};

function AdminAuditLogs() {
  const [filters, setFilters] = useState({
    range: "7d",
    source: "",
    category: "",
    severity: "",
    q: "",
  });
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    incidents: 0,
    failures: 0,
    actors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const loadAuditLogs = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const query = buildQuery(filters);
      const response = await fetch(`/api/auditLogs${query ? `?${query}` : ""}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load audit logs.");
      }
      setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      setSummary(payload?.summary || { total: 0, incidents: 0, failures: 0, actors: 0 });
      setError("");
    } catch (loadError) {
      console.error("Audit log fetch failed", loadError);
      setError(loadError.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const latestEvent = useMemo(() => entries[0] || null, [entries]);
  const terminalEntries = useMemo(
    () =>
      entries.map((entry, index) => {
        const detail = [
          entry.action,
          entry.actorLabel,
          [entry.targetType, entry.targetId].filter(Boolean).join(" "),
        ].filter(Boolean).join(" · ");
        return {
          id: entry.id || `${entry.createdAt || "event"}-${index}`,
          timestamp: entry.createdAt,
          level: String(entry.severity || "info").toLowerCase(),
          source: entry.source || "api",
          message: entry.summary || entry.action || "Audit event",
          detail: detail || "System activity",
          metadata: formatMetadata(entry.metadata),
        };
      }),
    [entries]
  );

  return (
    <div className="admin-page admin-audit-page">
      <div className="admin-shell admin-audit-shell">
        <AdminBreadcrumb items={[{ label: "Audit Log" }]} />

        <AdminPageHeader
          title="Audit Logs"
          subtitle="Track admin actions, system activity, and Railway incidents across the portal."
          actionsClassName="admin-header-actions admin-audit-actions"
          actions={(
            <button
              type="button"
              className="admin-secondary"
              onClick={() => loadAuditLogs({ silent: true })}
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          )}
        />

        <section className="glass-card admin-audit-filters">
          <div className="admin-audit-filter-grid">
            <SelectField
                fieldClassName="admin-audit-field"
                label="Range"
                value={filters.range}
                onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </SelectField>
            <SelectField
                fieldClassName="admin-audit-field"
                label="Source"
                value={filters.source}
                onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </SelectField>
            <SelectField
                fieldClassName="admin-audit-field"
                label="Category"
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </SelectField>
            <SelectField
                fieldClassName="admin-audit-field"
                label="Severity"
                value={filters.severity}
                onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </SelectField>
            <label className="admin-audit-filter-search">
              <span>Search</span>
              <input
                type="search"
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    loadAuditLogs();
                  }
                }}
                placeholder="Action, actor, resource"
              />
            </label>
          </div>
        </section>

        <section className="admin-cards admin-audit-kpis">
          <div className="bubble-card admin-card admin-audit-kpi-card">
            <p className="admin-card-label">Events</p>
            <h2>{summary.total}</h2>
            <span>{latestEvent ? `Latest ${formatDateTime(latestEvent.createdAt)}` : "No events yet"}</span>
          </div>
          <div className="bubble-card admin-card admin-audit-kpi-card">
            <p className="admin-card-label">Incidents</p>
            <h2>{summary.incidents}</h2>
            <span>Railway and system events</span>
          </div>
          <div className="bubble-card admin-card admin-audit-kpi-card">
            <p className="admin-card-label">Warnings / errors</p>
            <h2>{summary.failures}</h2>
            <span>Needs review</span>
          </div>
          <div className="bubble-card admin-card admin-audit-kpi-card">
            <p className="admin-card-label">Actors</p>
            <h2>{summary.actors}</h2>
            <span>Distinct users and systems</span>
          </div>
        </section>

        {error ? (
          <ERPFormNotice tone="danger" title="Audit log unavailable" onDismiss={() => setError("")}>
            {error}
          </ERPFormNotice>
        ) : null}
        {loading ? (
          <AnimatedLoadingState
            compact
            className="glass-card admin-audit-loading admin-module-loading"
            title="Loading audit logs"
            message="Reading activity, severity, and integration events."
            variant="dashboard"
          />
        ) : (
          <section className="glass-card admin-audit-command-log" aria-label="Recent audit command log">
            <div className="admin-audit-command-log__chrome">
              <span className="admin-audit-command-log__dot is-red" aria-hidden="true" />
              <span className="admin-audit-command-log__dot is-yellow" aria-hidden="true" />
              <span className="admin-audit-command-log__dot is-green" aria-hidden="true" />
              <span className="admin-audit-command-log__title">Recent activity</span>
              <span className={`admin-audit-command-log__live ${refreshing ? "is-refreshing" : ""}`}>
                {refreshing ? "Syncing" : "Live"}
              </span>
            </div>
            <div className="admin-audit-command-log__sync">
              {terminalEntries.length
                ? `${terminalEntries.length} event${terminalEntries.length === 1 ? "" : "s"} in the current result set`
                : "No audit events match the current filters"}
            </div>
            <div className="admin-audit-command-log__body">
              {terminalEntries.length ? (
                terminalEntries.map((entry) => (
                  <div className="admin-audit-command-row" key={entry.id}>
                    <span className="admin-audit-command-row__prompt" aria-hidden="true">$</span>
                    <span className="admin-audit-command-row__time" title={formatDateTime(entry.timestamp)}>
                      {formatDateTime(entry.timestamp)}
                    </span>
                    <span className={`admin-audit-command-row__level is-${getSeverityClass(entry.level)}`}>
                      {entry.level}
                    </span>
                    <span className="admin-audit-command-row__source" title={entry.source}>
                      {entry.source}
                    </span>
                    <span className="admin-audit-command-row__message" title={entry.message}>
                      {entry.message}
                    </span>
                    <span className="admin-audit-command-row__detail" title={entry.detail}>
                      {entry.detail}
                    </span>
                    {entry.metadata !== "—" ? (
                      <span className="admin-audit-command-row__metadata" title={entry.metadata}>
                        {entry.metadata}
                      </span>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="admin-audit-command-log__empty">
                  <span aria-hidden="true">$</span>
                  <span>Adjust the filters or refresh to see the latest admin activity.</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default AdminAuditLogs;
