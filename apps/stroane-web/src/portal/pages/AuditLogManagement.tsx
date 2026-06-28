import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineClipboardList,
  HiOutlineExclamation,
  HiOutlineRefresh,
  HiOutlineShieldCheck,
} from "react-icons/hi";
import {
  ERPFormNotice,
  ERPSecondaryAction,
  ERPStatusBadge,
  ERPTableSearch,
  SelectField,
} from "@faako/ui";
import useSEOMeta from "../../hooks/useSEOMeta";
import { portalUrl } from "../../config/appSurface";
import { useAdminPortal } from "../context/AdminPortalContext";
import {
  adminAuditLogsApi,
  type AdminAuditLogEntry,
  type AdminAuditLogFilters,
  type AdminAuditLogRange,
  type AdminAuditLogSource,
  type AdminAuditLogSummary,
} from "../api/adminAuditLogs";
import "../styles/AdminPortal.css";

const SOURCE_OPTIONS: Array<{ value: AdminAuditLogSource; label: string }> = [
  { value: "", label: "All sources" },
  { value: "inventory", label: "Inventory" },
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "receipts", label: "Receipts" },
  { value: "accounting", label: "Accounting" },
  { value: "crm", label: "CRM" },
  { value: "team", label: "Team" },
];

const RANGE_OPTIONS: Array<{ value: AdminAuditLogRange; label: string }> = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const EMPTY_SUMMARY: AdminAuditLogSummary = {
  total: 0,
  warnings: 0,
  errors: 0,
  bySource: {},
  latestAt: null,
};

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const formatLabel = (value = "") =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getSeverityTone = (severity = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  const normalized = severity.toLowerCase();
  if (normalized === "error") return "danger";
  if (normalized === "warning") return "warning";
  return "info";
};

const getSourceTone = (source = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  if (source === "payments" || source === "receipts") return "success";
  if (source === "inventory") return "warning";
  if (source === "team") return "danger";
  if (source === "crm") return "neutral";
  return "info";
};

const getTopSource = (summary: AdminAuditLogSummary) => {
  const [source, count] =
    Object.entries(summary.bySource || {}).sort((left, right) => right[1] - left[1])[0] || [];
  return source ? `${formatLabel(source)} (${count})` : "No source yet";
};

const AuditLogManagement: React.FC = () => {
  const { session } = useAdminPortal();
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AdminAuditLogSummary>(EMPTY_SUMMARY);
  const [filters, setFilters] = useState<AdminAuditLogFilters>({
    range: "7d",
    source: "",
    search: "",
    limit: 150,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useSEOMeta({
    title: "Audit Logs | Stroane Portal",
    description: "Review admin-only operational audit activity across Stroane portal modules.",
    canonical: portalUrl("/admin/audit-logs"),
  });

  const loadAuditLogs = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminAuditLogsApi.listAuditLogs(session, filters);
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setSummary(data.summary || EMPTY_SUMMARY);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load audit logs.");
      setEntries([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [filters, session]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const hasActiveFilters = Boolean(filters.search || filters.source || filters.range !== "7d");
  const issueCount = summary.warnings + summary.errors;
  const sourceCount = useMemo(() => Object.keys(summary.bySource || {}).length, [summary.bySource]);

  const updateFilter = <K extends keyof AdminAuditLogFilters>(
    key: K,
    value: AdminAuditLogFilters[K]
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <section className="stroane-audit">
      <header className="stroane-audit__head">
        <div>
          <span className="stroane-audit__eyebrow">
            <HiOutlineShieldCheck aria-hidden="true" />
            Admin only
          </span>
          <h1>Audit logs</h1>
          <p>Review recent operational changes, payment events, receipts, inventory movement, and team activity.</p>
        </div>
        <ERPSecondaryAction
          size="sm"
          icon={<HiOutlineRefresh aria-hidden="true" />}
          onClick={() => void loadAuditLogs()}
          disabled={loading}
        >
          Refresh
        </ERPSecondaryAction>
      </header>

      {error ? (
        <ERPFormNotice tone="danger" title="Audit logs" onDismiss={() => setError("")}>
          {error}
        </ERPFormNotice>
      ) : null}

      <div className="stroane-audit__stats" aria-label="Audit log overview">
        <article className="bubble-card stroane-audit__stat">
          <span><HiOutlineClipboardList aria-hidden="true" /> Events</span>
          <strong>{summary.total.toLocaleString()}</strong>
          <small>{formatDateTime(summary.latestAt)}</small>
        </article>
        <article className="bubble-card stroane-audit__stat">
          <span><HiOutlineExclamation aria-hidden="true" /> Needs review</span>
          <strong>{issueCount.toLocaleString()}</strong>
          <small>{summary.errors} errors · {summary.warnings} warnings</small>
        </article>
        <article className="bubble-card stroane-audit__stat">
          <span><HiOutlineShieldCheck aria-hidden="true" /> Sources</span>
          <strong>{sourceCount.toLocaleString()}</strong>
          <small>{getTopSource(summary)}</small>
        </article>
      </div>

      <section className="stroane-audit__filters" aria-label="Audit log filters">
        <ERPTableSearch
          label="Search audit logs"
          value={filters.search || ""}
          onChange={(event) => updateFilter("search", event.target.value)}
          placeholder="Search action, target, actor, source"
        />
        <SelectField
          label="Source"
          value={filters.source || ""}
          onChangeValue={(value) => updateFilter("source", getSelectValue(value) as AdminAuditLogSource)}
          options={SOURCE_OPTIONS}
        />
        <SelectField
          label="Range"
          value={filters.range || "7d"}
          onChangeValue={(value) => updateFilter("range", getSelectValue(value) as AdminAuditLogRange)}
          options={RANGE_OPTIONS}
        />
        {hasActiveFilters ? (
          <ERPSecondaryAction
            size="sm"
            onClick={() => setFilters({ range: "7d", source: "", search: "", limit: 150 })}
          >
            Clear
          </ERPSecondaryAction>
        ) : null}
      </section>

      <div className="stroane-audit__admin-table admin-table admin-table-scroll">
        <table className="stroane-audit__table">
          <colgroup>
            <col className="stroane-audit__col-time" />
            <col className="stroane-audit__col-source" />
            <col className="stroane-audit__col-event" />
            <col className="stroane-audit__col-actor" />
            <col className="stroane-audit__col-target" />
            <col className="stroane-audit__col-severity" />
          </colgroup>
          <thead>
            <tr>
              <th>Time</th>
              <th className="col-desktop">Source</th>
              <th>Event</th>
              <th className="col-desktop">Actor</th>
              <th className="col-desktop">Target</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="stroane-audit__table-empty">
                  Loading audit logs...
                </td>
              </tr>
            ) : null}
            {!loading && !entries.length ? (
              <tr>
                <td colSpan={6} className="stroane-audit__table-empty">
                  No audit events match the current view.
                </td>
              </tr>
            ) : null}
            {!loading
              ? entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Time">
                      <span className="stroane-audit__date">{formatDateTime(entry.createdAt)}</span>
                    </td>
                    <td className="col-desktop" data-label="Source">
                      <ERPStatusBadge tone={getSourceTone(entry.source)}>
                        {formatLabel(entry.source)}
                      </ERPStatusBadge>
                    </td>
                    <td data-label="Event">
                      <span className="stroane-audit__event">
                        <strong>{formatLabel(entry.action)}</strong>
                      </span>
                    </td>
                    <td className="col-desktop" data-label="Actor">
                      <span className="stroane-audit__truncate">{entry.actorName || "System"}</span>
                    </td>
                    <td className="col-desktop" data-label="Target">
                      <span className="stroane-audit__target">
                        <strong>{entry.targetId || "N/A"}</strong>
                      </span>
                    </td>
                    <td data-label="Severity">
                      <ERPStatusBadge tone={getSeverityTone(entry.severity)}>
                        {formatLabel(entry.severity)}
                      </ERPStatusBadge>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AuditLogManagement;
