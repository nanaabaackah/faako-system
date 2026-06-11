import React, { useCallback, useEffect, useMemo, useState } from "react";
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

  return (
    <div className="admin-page admin-audit-page">
      <div className="admin-shell admin-audit-shell">
        <AdminBreadcrumb items={[{ label: "Audit Log" }]} />

        <AdminPageHeader
          eyebrow="Compliance"
          title="Audit Log"
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

        <section className="admin-card admin-audit-filters">
          <div className="admin-audit-filter-grid admin-form">
            <label>
              Range
              <select
                value={filters.range}
                onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source
              <select
                value={filters.source}
                onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Severity
              <select
                value={filters.severity}
                onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-audit-filter-search">
              Search
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
          <div className="admin-card">
            <p className="admin-card-label">Events</p>
            <h2>{summary.total}</h2>
            <span>{latestEvent ? `Latest ${formatDateTime(latestEvent.createdAt)}` : "No events yet"}</span>
          </div>
          <div className="admin-card">
            <p className="admin-card-label">Incidents</p>
            <h2>{summary.incidents}</h2>
            <span>Railway and system events</span>
          </div>
          <div className="admin-card">
            <p className="admin-card-label">Warnings / errors</p>
            <h2>{summary.failures}</h2>
            <span>Needs review</span>
          </div>
          <div className="admin-card">
            <p className="admin-card-label">Actors</p>
            <h2>{summary.actors}</h2>
            <span>Distinct users and systems</span>
          </div>
        </section>

        {error ? <p className="admin-audit-error">{error}</p> : null}
        {loading ? <p className="admin-audit-muted">Loading audit log…</p> : null}

        <section className="admin-card admin-audit-log-list">
          <div className="admin-audit-panel-head">
            <h2>Recent activity</h2>
            <p className="admin-audit-muted">
              {entries.length
                ? `${entries.length} event${entries.length === 1 ? "" : "s"} in the current result set.`
                : "No audit events match the current filters."}
            </p>
          </div>

          <div className="admin-audit-entries">
            {entries.map((entry) => (
              <article className="admin-audit-entry" key={entry.id}>
                <div className="admin-audit-entry-main">
                  <div className="admin-audit-entry-head">
                    <strong>{entry.summary || entry.action}</strong>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p>
                    {entry.action}
                    {entry.actorLabel ? ` · ${entry.actorLabel}` : ""}
                    {entry.targetType ? ` · ${entry.targetType}` : ""}
                    {entry.targetId ? ` ${entry.targetId}` : ""}
                  </p>
                  {entry.metadata ? (
                    <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                  ) : null}
                </div>
                <div className="admin-audit-entry-badges">
                  <span className={`admin-audit-badge is-${String(entry.severity || "info").toLowerCase()}`}>
                    {entry.severity || "info"}
                  </span>
                  <span className="admin-audit-badge is-neutral">{entry.source || "api"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminAuditLogs;
