import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../api/client";
import { formatDateTime } from "../../utils/formatters";
import "./AuditLogs.css";

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
  { value: "job", label: "Jobs" },
  { value: "system", label: "System" },
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
  { value: "admin", label: "Admin" },
  { value: "financial", label: "Financial" },
  { value: "incident", label: "Incident" },
];

const formatCount = (value) => Number(value || 0).toLocaleString("en-US");

const buildQuery = (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    params.set(key, normalized);
  });
  return params.toString();
};

const AuditLogs = () => {
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
      const payload = await apiGet(`/api/audit-logs${query ? `?${query}` : ""}`, {
        fallbackMessage: "Unable to load audit logs.",
      });
      setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      setSummary(payload?.summary || { total: 0, incidents: 0, failures: 0, actors: 0 });
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleFilterChange = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    loadAuditLogs();
  };

  const latestEvent = useMemo(() => entries[0] || null, [entries]);

  return (
    <section className="page audit-logs-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Compliance</p>
          <h1>Audit logs</h1>
          <p className="muted">
            Review server activity, admin operations, and Railway incident events.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadAuditLogs({ silent: true })}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <section className="panel audit-filters-panel">
        <form className="audit-filters" onSubmit={handleSearchSubmit}>
          <label className="field">
            <span>Range</span>
            <select
              className="input"
              value={filters.range}
              onChange={(event) => handleFilterChange("range", event.target.value)}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Source</span>
            <select
              className="input"
              value={filters.source}
              onChange={(event) => handleFilterChange("source", event.target.value)}
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select
              className="input"
              value={filters.category}
              onChange={(event) => handleFilterChange("category", event.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Severity</span>
            <select
              className="input"
              value={filters.severity}
              onChange={(event) => handleFilterChange("severity", event.target.value)}
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field audit-filters__search">
            <span>Search</span>
            <input
              className="input"
              type="search"
              value={filters.q}
              onChange={(event) => handleFilterChange("q", event.target.value)}
              placeholder="Action, actor, resource"
            />
          </label>
          <div className="audit-filters__actions">
            <button className="button button-primary" type="submit" disabled={loading}>
              Apply
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading audit logs...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="kpi-grid" aria-label="Audit log summary">
        <article className="panel">
          <span className="kpi-label">Events</span>
          <div className="kpi-value">{formatCount(summary.total)}</div>
          <span className="kpi-delta">Captured in the current filter window</span>
        </article>
        <article className="panel">
          <span className="kpi-label">Incidents</span>
          <div className="kpi-value">{formatCount(summary.incidents)}</div>
          <span className="kpi-delta">Railway and system interruptions</span>
        </article>
        <article className="panel">
          <span className="kpi-label">Warnings / Errors</span>
          <div className="kpi-value">{formatCount(summary.failures)}</div>
          <span className="kpi-delta">Events that may need follow-up</span>
        </article>
        <article className="panel">
          <span className="kpi-label">Actors</span>
          <div className="kpi-value">{formatCount(summary.actors)}</div>
          <span className="kpi-delta">
            {latestEvent ? `Latest event ${formatDateTime(latestEvent.createdAt)}` : "No events yet"}
          </span>
        </article>
      </section>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Recent activity</h3>
            <p className="muted">
              {entries.length
                ? `${entries.length} event${entries.length === 1 ? "" : "s"} in the current result set`
                : "No audit events match the current filters."}
            </p>
          </div>
        </div>
        <div className="timeline audit-timeline">
          {entries.length ? (
            entries.map((entry) => (
              <div className="timeline-row audit-timeline__row" key={entry.id}>
                <span className="timeline-time">{formatDateTime(entry.createdAt)}</span>
                <div className="audit-entry">
                  <span className="table-strong">{entry.summary || entry.action}</span>
                  <p className="muted">
                    {entry.action}
                    {entry.actorLabel ? ` · ${entry.actorLabel}` : ""}
                    {entry.targetType ? ` · ${entry.targetType}` : ""}
                    {entry.targetId ? ` ${entry.targetId}` : ""}
                  </p>
                  {entry.metadata ? (
                    <pre className="audit-entry__metadata">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
                <div className="audit-entry__badges">
                  <span className={`priority is-${entry.severity || "normal"}`}>
                    {entry.severity || "info"}
                  </span>
                  <span className="priority">{entry.source || "api"}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No audit logs yet.</p>
          )}
        </div>
      </article>
    </section>
  );
};

export default AuditLogs;
