import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatedLoadingState, SelectField } from "@faako/ui";
import { apiGet } from "../../api/client";
import downloadCsv from "../../utils/exportCsv";
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

const formatCount = (value) => Number(value || 0).toLocaleString("en-US");
const DEFAULT_FILTERS = {
  range: "7d",
  source: "",
  severity: "",
  q: "",
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

const AuditLogs = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
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
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");

  const loadAuditLogs = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const query = buildQuery(appliedFilters);
      const suffix = query ? `?${query}` : "";
      const [logsResult, analyticsResult] = await Promise.allSettled([
        apiGet(`/api/audit-logs${suffix}`, {
          fallbackMessage: "Unable to load audit logs.",
        }),
        apiGet(`/api/audit-logs/summary${suffix}`, {
          fallbackMessage: "Unable to load audit analytics.",
        }),
      ]);
      if (logsResult.status === "fulfilled") {
        const payload = logsResult.value;
        setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
        setSummary(payload?.summary || { total: 0, incidents: 0, failures: 0, actors: 0 });
        setError("");
      } else {
        setError(logsResult.reason?.message || "Unable to load audit logs.");
      }

      if (analyticsResult.status === "fulfilled") {
        setAnalytics(analyticsResult.value || null);
        setAnalyticsError("");
      } else {
        setAnalyticsError(analyticsResult.reason?.message || "Unable to load audit analytics.");
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedFilters]);

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
    if (buildQuery(filters) === buildQuery(appliedFilters)) {
      loadAuditLogs();
      return;
    }
    setAppliedFilters({ ...filters });
  };

  const latestEvent = useMemo(() => entries[0] || null, [entries]);
  const handleExportSnapshot = () => {
    if (!analytics) return;
    const rows = [
      ["Metric", "Value"],
      ...((Array.isArray(analytics.kpis) ? analytics.kpis : []).map((item) => [
        item.label,
        item.value,
      ])),
      [],
      ["Top action", "Count"],
      ...((Array.isArray(analytics.topActions) ? analytics.topActions : []).map((item) => [
        item.label,
        item.count,
      ])),
      [],
      ["Date", "Events", "Incidents", "Failures"],
      ...((Array.isArray(analytics.series) ? analytics.series : []).map((item) => [
        item.date,
        item.total,
        item.incidents,
        item.failures,
      ])),
    ];
    downloadCsv(`audit_report_${appliedFilters.range}.csv`, rows);
  };

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
          <button
            className="button button-primary"
            type="button"
            onClick={handleExportSnapshot}
            disabled={!analytics}
          >
            Export analytics
          </button>
        </div>
      </header>

      <section className="panel audit-filters-panel">
        <form className="audit-filters" onSubmit={handleSearchSubmit}>
          <SelectField
              fieldClassName="field"
              label="Range"
              value={filters.range}
              onChange={(event) => handleFilterChange("range", event.target.value)}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </SelectField>
          <SelectField
              fieldClassName="field"
              label="Source"
              value={filters.source}
              onChange={(event) => handleFilterChange("source", event.target.value)}
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </SelectField>
          <SelectField
              fieldClassName="field"
              label="Severity"
              value={filters.severity}
              onChange={(event) => handleFilterChange("severity", event.target.value)}
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </SelectField>
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
        <AnimatedLoadingState compact className="panel" title="Loading audit logs" />
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {analyticsError ? (
        <div className="notice is-error" role="alert">
          {analyticsError}
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

      {analytics ? (
        <section className="audit-analytics-grid" aria-label="Audit analytics">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Recent incidents</h3>
                <p className="muted">
                  Railway and system events captured in the current audit window.
                </p>
              </div>
            </div>
            <div className="timeline">
              {(Array.isArray(analytics.recentIncidents) ? analytics.recentIncidents : []).length ? (
                analytics.recentIncidents.map((entry) => (
                  <div className="timeline-row" key={entry.id}>
                    <span className="timeline-time">{formatDateTime(entry.createdAt)}</span>
                    <div>
                      <span className="table-strong">{entry.summary}</span>
                      <p className="muted">
                        {entry.action}
                        {entry.targetId ? ` · ${entry.targetId}` : ""}
                      </p>
                    </div>
                    <span className={`priority is-${entry.severity || "normal"}`}>
                      {entry.status || entry.severity || "event"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">No incidents recorded in this window.</p>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Activity hotspots</h3>
                <p className="muted">Top actions, sources, and actors from the audit stream.</p>
              </div>
            </div>
            <div className="audit-summary-list">
              <div className="audit-summary-item">
                <span>Top actions</span>
                <strong>
                  {(Array.isArray(analytics.topActions) ? analytics.topActions : [])
                    .slice(0, 4)
                    .map((item) => `${item.label} (${item.count})`)
                    .join(", ") || "No data"}
                </strong>
              </div>
              <div className="audit-summary-item">
                <span>Top sources</span>
                <strong>
                  {(Array.isArray(analytics.topSources) ? analytics.topSources : [])
                    .slice(0, 4)
                    .map((item) => `${item.label} (${item.count})`)
                    .join(", ") || "No data"}
                </strong>
              </div>
              <div className="audit-summary-item">
                <span>Top actors</span>
                <strong>
                  {(Array.isArray(analytics.topActors) ? analytics.topActors : [])
                    .slice(0, 4)
                    .map((item) => `${item.label} (${item.count})`)
                    .join(", ") || "No data"}
                </strong>
              </div>
            </div>
          </article>
        </section>
      ) : null}

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
