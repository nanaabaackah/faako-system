import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminReports.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";

const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
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

const downloadCsv = (filename, rows) => {
  if (typeof window === "undefined") return;
  const content = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

function AdminReports() {
  const [range, setRange] = useState("7d");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const query = new URLSearchParams({ range });
      const response = await fetch(`/api/reports?${query.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load reports.");
      }
      setSummary(payload || null);
      setError("");
    } catch (loadError) {
      console.error("Reports fetch failed", loadError);
      setError(loadError.message || "Unable to load reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const generatedLabel = useMemo(
    () => formatDateTime(summary?.generatedAt),
    [summary?.generatedAt]
  );

  const exportSnapshot = () => {
    if (!summary) return;
    const rows = [
      ["Range", summary.rangeLabel || range],
      ["Generated at", generatedLabel],
      [],
      ["KPI", "Value", "Helper"],
      ...((Array.isArray(summary.kpis) ? summary.kpis : []).map((item) => [
        item.label,
        item.value,
        item.helper,
      ])),
      [],
      ["Date", "Events", "Incidents", "Warnings / errors"],
      ...((Array.isArray(summary.series) ? summary.series : []).map((item) => [
        item.date,
        item.total,
        item.incidents,
        item.failures,
      ])),
      [],
      ["Top action", "Count"],
      ...((Array.isArray(summary.topActions) ? summary.topActions : []).map((item) => [
        item.label,
        item.count,
      ])),
    ];
    downloadCsv(`reebs_portal_reports_${range}.csv`, rows);
  };

  return (
    <div className="admin-page admin-reports-page">
      <div className="admin-shell admin-reports-shell">
        <AdminBreadcrumb items={[{ label: "Reports" }]} />

        <AdminPageHeader
          eyebrow="Operations"
          title="Reports"
          subtitle="Review performance, incident trends, and system activity for the current portal organization."
          actionsClassName="admin-header-actions admin-reports-actions"
          actions={(
            <>
              <label className="admin-report-range admin-form">
                <span className="sr-only">Reporting range</span>
                <select value={range} onChange={(event) => setRange(event.target.value)}>
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="admin-secondary"
                onClick={exportSnapshot}
                disabled={!summary || loading}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="admin-secondary"
                onClick={() => loadSummary({ silent: true })}
                disabled={loading || refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </>
          )}
        />

        {error ? <p className="admin-reports-error">{error}</p> : null}
        {loading ? <p className="admin-reports-muted">Loading reports…</p> : null}

        <section className="admin-cards admin-reports-kpis">
          {(summary?.kpis || []).map((item) => (
            <div className="admin-card" key={item.key}>
              <p className="admin-card-label">{item.label}</p>
              <h2>{item.value}</h2>
              <span>{item.helper}</span>
            </div>
          ))}
        </section>

        <section className="admin-card admin-reports-panel">
          <div className="admin-reports-panel-head">
            <div>
              <h2>Report window</h2>
              <p className="admin-reports-panel-copy">
                {summary?.rangeLabel || "Current range"} · Generated {generatedLabel}
              </p>
            </div>
          </div>

          <div className="admin-report-controls admin-form">
            <label>
              Range
              <select value={range} onChange={(event) => setRange(event.target.value)}>
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="admin-reports-grid">
          <article className="admin-card admin-reports-panel">
            <div className="admin-reports-panel-head">
              <div>
                <h2>Activity trend</h2>
                <p className="admin-reports-panel-copy">Daily audit volume, incidents, and warning counts.</p>
              </div>
            </div>

            <div className="admin-reports-table-wrap">
              <table className="admin-reports-series-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Events</th>
                    <th>Incidents</th>
                    <th>Warnings / errors</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.series || []).map((item) => (
                    <tr key={item.date}>
                      <td>{item.date}</td>
                      <td>{item.total}</td>
                      <td>{item.incidents}</td>
                      <td>{item.failures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="admin-card admin-reports-panel">
            <div className="admin-reports-panel-head">
              <div>
                <h2>Recent incidents</h2>
                <p className="admin-reports-panel-copy">Railway and system events that need admin attention.</p>
              </div>
            </div>

            <div className="admin-report-list">
              {(summary?.recentIncidents || []).map((entry) => (
                <article className="admin-report-list-item" key={entry.id || entry.externalRef || entry.createdAt}>
                  <div className="admin-report-list-body">
                    <div className="admin-report-list-head">
                      <strong>{entry.summary || entry.action}</strong>
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <p>{entry.action}</p>
                  </div>
                  <div className="admin-report-list-badges">
                    <span className={`admin-report-badge is-${String(entry.severity || "info").toLowerCase()}`}>
                      {entry.severity || "info"}
                    </span>
                    <span className="admin-report-badge is-neutral">{entry.source || "railway"}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="admin-reports-grid admin-reports-grid--three">
          <article className="admin-card admin-reports-panel">
            <div className="admin-reports-panel-head">
              <div>
                <h2>Top actions</h2>
                <p className="admin-reports-panel-copy">Most frequent workflow events in the selected range.</p>
              </div>
            </div>
            <div className="admin-report-list">
              {(summary?.topActions || []).map((item) => (
                <article className="admin-report-list-item" key={item.label}>
                  <div className="admin-report-list-body">
                    <div className="admin-report-list-head">
                      <strong>{item.label}</strong>
                      <span>{item.count}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="admin-card admin-reports-panel">
            <div className="admin-reports-panel-head">
              <div>
                <h2>Top sources</h2>
                <p className="admin-reports-panel-copy">Where the most activity originated.</p>
              </div>
            </div>
            <div className="admin-report-list">
              {(summary?.topSources || []).map((item) => (
                <article className="admin-report-list-item" key={item.label}>
                  <div className="admin-report-list-body">
                    <div className="admin-report-list-head">
                      <strong>{item.label}</strong>
                      <span>{item.count}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="admin-card admin-reports-panel">
            <div className="admin-reports-panel-head">
              <div>
                <h2>Top categories</h2>
                <p className="admin-reports-panel-copy">Business areas generating the most audit activity.</p>
              </div>
            </div>
            <div className="admin-report-list">
              {(summary?.topCategories || []).map((item) => (
                <article className="admin-report-list-item" key={item.label}>
                  <div className="admin-report-list-body">
                    <div className="admin-report-list-head">
                      <strong>{item.label}</strong>
                      <span>{item.count}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="admin-card admin-reports-panel">
          <div className="admin-reports-panel-head">
            <div>
              <h2>Latest audit events</h2>
              <p className="admin-reports-panel-copy">The newest tracked actions across the admin backend.</p>
            </div>
          </div>

          <div className="admin-report-list">
            {(summary?.recentEvents || []).map((entry) => (
              <article className="admin-report-list-item" key={entry.id || entry.createdAt}>
                <div className="admin-report-list-body">
                  <div className="admin-report-list-head">
                    <strong>{entry.summary || entry.action}</strong>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p>
                    {entry.action}
                    {entry.actorLabel ? ` · ${entry.actorLabel}` : ""}
                    {entry.targetType ? ` · ${entry.targetType}` : ""}
                    {entry.targetId ? ` ${entry.targetId}` : ""}
                  </p>
                </div>
                <div className="admin-report-list-badges">
                  <span className={`admin-report-badge is-${String(entry.severity || "info").toLowerCase()}`}>
                    {entry.severity || "info"}
                  </span>
                  <span className="admin-report-badge is-neutral">{entry.category || "admin"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminReports;
