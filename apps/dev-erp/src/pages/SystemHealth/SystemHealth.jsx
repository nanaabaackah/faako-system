import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight2,
  Copy,
  Danger,
  DocumentText,
  Link2,
  Magicpen,
  Monitor,
  Refresh2,
  TickCircle,
  Warning2,
} from "iconsax-react";
import { AnimatedLoadingState, ERPStatusBadge } from "@faako/ui";
import { apiPost } from "../../api/client";
import useDashboardData from "../../hooks/useDashboardData";
import { formatDateTime } from "../../utils/formatters";
import { formatStatusLabel, getStatusTone } from "../../utils/status";
import {
  buildHealthIncidents,
  getHealthSummaryState,
  isMonitorHealthy,
} from "./systemHealthDiagnostics";
import "./SystemHealth.css";

const INCIDENT_NOTES_KEY = "dev-incident-notes";

const DATABASE_MONITORS = [
  { id: "portfolio-db", label: "Primary database", statusKey: "portfolioDb", note: "Core organization and Dev ERP data" },
  { id: "reebs-db", label: "REEBS database", statusKey: "reebsDb", note: "REEBS operational data" },
  { id: "faako-db", label: "Faako database", statusKey: "faakoDb", note: "Faako onboarding and platform data" },
  { id: "stroane-db", label: "Stroane database", statusKey: "stroaneDb", note: "Stroane commerce and inventory data" },
];

const readStoredNotes = () => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(INCIDENT_NOTES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isSafeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const getMonitorStatus = (checks, fallback = "unknown") => {
  if (!Array.isArray(checks) || !checks.length) return fallback || "unknown";
  if (checks.some((check) => ["offline", "error", "failed"].includes(String(check?.status).toLowerCase()))) {
    return "offline";
  }
  if (checks.every((check) => String(check?.status).toLowerCase() === "not_configured")) {
    return "not_configured";
  }
  if (checks.some((check) => !isMonitorHealthy(check?.status))) return "degraded";
  return "online";
};

const buildMonitors = (kpiData) => {
  const systemStatus = kpiData?.status || {};
  const apiMonitors = (Array.isArray(kpiData?.apiSurfaces) ? kpiData.apiSurfaces : []).map((surface) => ({
    id: `api-${surface.id}`,
    sourceId: surface.id,
    label: surface.label || surface.id,
    category: "API",
    kind: "api",
    status: surface.status || getMonitorStatus(surface.pages),
    note: surface.note || "API health endpoints",
    baseUrl: surface.baseUrl || "",
    checks: Array.isArray(surface.pages) ? surface.pages : [],
  }));

  const databaseMonitors = DATABASE_MONITORS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    category: "Database",
    kind: "database",
    status: systemStatus[definition.statusKey] || "not_configured",
    note: definition.note,
    baseUrl: "",
    checks: [],
  }));

  const surfaceMonitors = (Array.isArray(kpiData?.siteStatus?.sites) ? kpiData.siteStatus.sites : []).map((site) => ({
    id: `surface-${site.id}`,
    sourceId: site.id,
    label: site.title || site.id,
    category: site.category || "Website",
    kind: "surface",
    status: site.aggregateStatus || getMonitorStatus(site.pages),
    note: site.purpose || `${site.pages?.length || 0} routes monitored`,
    baseUrl: site.baseUrl || "",
    checks: Array.isArray(site.pages) ? site.pages : [],
  }));

  return [...apiMonitors, ...databaseMonitors, ...surfaceMonitors];
};

const getStatusIcon = (tone, size = 20) => {
  if (tone === "danger") return <Danger size={size} aria-hidden="true" />;
  if (tone === "warning" || tone === "info") return <Warning2 size={size} aria-hidden="true" />;
  return <TickCircle size={size} aria-hidden="true" />;
};

const StatusBadge = ({ status }) => {
  const tone = getStatusTone(status);
  return (
    <ERPStatusBadge tone={tone} className={`status-pill is-${tone}`}>
      {formatStatusLabel(status)}
    </ERPStatusBadge>
  );
};

const formatCheckEvidence = (check) => {
  const parts = [];
  if (check?.httpStatus) parts.push(`HTTP ${check.httpStatus}`);
  if (Number.isFinite(Number(check?.responseTimeMs))) parts.push(`${Number(check.responseTimeMs)} ms`);
  if (check?.errorType) parts.push(String(check.errorType).replace(/_/g, " "));
  return parts.join(" · ") || formatStatusLabel(check?.status);
};

const SystemHealth = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const monitors = useMemo(() => buildMonitors(kpiData), [kpiData]);
  const incidents = useMemo(() => buildHealthIncidents(monitors), [monitors]);
  const summaryState = useMemo(() => getHealthSummaryState(incidents), [incidents]);
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [aiDiagnosis, setAiDiagnosis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [incidentNotes, setIncidentNotes] = useState(readStoredNotes);

  useEffect(() => {
    if (!incidents.length) {
      setSelectedIncidentId("");
      return;
    }
    if (!incidents.some((incident) => incident.id === selectedIncidentId)) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  useEffect(() => {
    localStorage.setItem(INCIDENT_NOTES_KEY, JSON.stringify(incidentNotes));
  }, [incidentNotes]);

  useEffect(() => {
    setAiDiagnosis(null);
    setAiError("");
    setCopyStatus("");
  }, [selectedIncidentId]);

  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId) || null;
  const selectedNotes = incidentNotes.filter((note) => (
    !selectedIncident || !note.incidentId || note.incidentId === selectedIncident.id
  ));
  const healthyMonitorCount = monitors.filter((monitor) => isMonitorHealthy(monitor.status)).length;
  const configuredChecks = monitors.flatMap((monitor) => monitor.checks || [])
    .filter((check) => String(check?.status).toLowerCase() !== "not_configured");
  const measuredResponseTimes = configuredChecks
    .map((check) => Number(check?.responseTimeMs))
    .filter(Number.isFinite);
  const averageResponseTime = measuredResponseTimes.length
    ? Math.round(measuredResponseTimes.reduce((total, value) => total + value, 0) / measuredResponseTimes.length)
    : null;
  const lastCheckedLabel = formatDateTime(kpiData?.siteStatus?.checkedAt || kpiData?.lastSyncedAt);

  const handleRefresh = () => {
    setAiDiagnosis(null);
    setAiError("");
    reload({ silent: true, forceHealth: true });
  };

  const handleAnalyzeIncident = async () => {
    if (!selectedIncident || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const payload = await apiPost(
        "/api/ai/system-health-diagnosis",
        { incident: selectedIncident },
        { fallbackMessage: "Unable to generate AI diagnostics." }
      );
      setAiDiagnosis(payload?.diagnosis || null);
    } catch (requestError) {
      setAiError(requestError.message || "Unable to generate AI diagnostics.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyDiagnostics = async () => {
    if (!selectedIncident) return;
    const actions = aiDiagnosis?.actions || selectedIncident.actions;
    const text = [
      `${selectedIncident.label} — ${formatStatusLabel(selectedIncident.status)}`,
      aiDiagnosis?.executiveSummary || selectedIncident.summary,
      `Likely cause: ${aiDiagnosis?.likelyCause || selectedIncident.likelyCause}`,
      `Impact: ${aiDiagnosis?.impact || selectedIncident.impact}`,
      "Actions:",
      ...actions.map((action, index) => `${index + 1}. ${action.title}: ${action.instruction || action.detail}`),
      "Evidence:",
      ...selectedIncident.evidence.map((entry) => `- ${entry.label}${entry.url ? ` — ${entry.url}` : ""}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  const handleAddNote = (event) => {
    event.preventDefault();
    const text = noteDraft.trim();
    if (!text || !selectedIncident) return;
    setIncidentNotes((current) => [{
      id: `${Date.now()}`,
      incidentId: selectedIncident.id,
      incidentLabel: selectedIncident.label,
      text,
      createdAt: new Date().toISOString(),
      kind: "manual",
    }, ...current]);
    setNoteDraft("");
  };

  const selectMonitorIncident = (monitorId) => {
    const incident = incidents.find((item) => item.monitorId === monitorId);
    if (!incident) return;
    setSelectedIncidentId(incident.id);
    document.getElementById("health-diagnosis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="page system-health-page">
      <header className="page-header system-health-header">
        <div>
          <p className="eyebrow">System operations</p>
          <h1>System health</h1>
          <p className="muted">Live triage across apps, APIs, routes, and databases.</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
          >
            <Refresh2 size={18} aria-hidden="true" />
            <span>{isRefreshing ? "Checking..." : "Run checks"}</span>
          </button>
        </div>
      </header>

      {loading ? <AnimatedLoadingState page variant="dashboard" title="Checking system health" /> : null}
      {error ? <div className="notice is-error" role="alert">{error}</div> : null}

      {kpiData ? (
        <>
          <section className={`health-command-band is-${summaryState.tone}`} aria-live="polite">
            <div className="health-command-band__state">
              <span className="health-command-band__icon">
                {getStatusIcon(summaryState.tone, 24)}
              </span>
              <div>
                <h2>{summaryState.title}</h2>
                <p>{summaryState.detail}</p>
              </div>
            </div>
            <dl className="health-command-band__metrics">
              <div><dt>Services</dt><dd>{healthyMonitorCount}/{monitors.length}</dd></div>
              <div><dt>Critical</dt><dd>{summaryState.critical}</dd></div>
              <div><dt>Warnings</dt><dd>{summaryState.warning}</dd></div>
              <div><dt>Coverage gaps</dt><dd>{summaryState.coverage}</dd></div>
              <div><dt>Average response</dt><dd>{averageResponseTime === null ? "N/A" : `${averageResponseTime} ms`}</dd></div>
            </dl>
            <p className="health-command-band__checked">Last checked {lastCheckedLabel}</p>
          </section>

          {incidents.length ? (
            <div className="health-workspace">
              <section className="health-section health-triage" aria-label="Incident queue">
                <div className="health-section__header">
                  <div>
                    <p className="eyebrow">Triage queue</p>
                    <h2>What needs attention</h2>
                  </div>
                  <span className="health-count">{incidents.length}</span>
                </div>
                <div className="health-incident-list">
                  {incidents.map((incident) => (
                    <button
                      className={`health-incident-row is-${incident.severity} ${selectedIncidentId === incident.id ? "is-selected" : ""}`}
                      type="button"
                      key={incident.id}
                      onClick={() => setSelectedIncidentId(incident.id)}
                    >
                      <span className="health-incident-row__icon">
                        {getStatusIcon(incident.severity === "critical" ? "danger" : "warning")}
                      </span>
                      <span className="health-incident-row__body">
                        <strong>{incident.label}</strong>
                        <span>{incident.summary}</span>
                        <small>{incident.evidence[0]?.label || formatStatusLabel(incident.status)}</small>
                      </span>
                      <ArrowRight2 size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>

              <section className="health-section health-diagnosis" id="health-diagnosis">
                {selectedIncident ? (
                  <>
                    <div className="health-diagnosis__header">
                      <div>
                        <p className="eyebrow">Incident diagnosis</p>
                        <h2>{selectedIncident.label}</h2>
                        <p>{selectedIncident.summary}</p>
                      </div>
                      <StatusBadge status={selectedIncident.status} />
                    </div>

                    <div className="health-diagnosis__actions">
                      <button className="button button-primary" type="button" onClick={handleAnalyzeIncident} disabled={aiLoading}>
                        <Magicpen size={18} aria-hidden="true" />
                        <span>{aiLoading ? "Analyzing..." : aiDiagnosis ? "Analyze again" : "Analyze with AI"}</span>
                      </button>
                      <button className="button button-ghost" type="button" onClick={handleCopyDiagnostics}>
                        <Copy size={18} aria-hidden="true" />
                        <span>{copyStatus || "Copy diagnosis"}</span>
                      </button>
                      {isSafeHttpUrl(selectedIncident.evidence[0]?.url) ? (
                        <a className="button button-ghost" href={selectedIncident.evidence[0].url} target="_blank" rel="noreferrer">
                          <Link2 size={18} aria-hidden="true" />
                          <span>Open endpoint</span>
                        </a>
                      ) : null}
                    </div>

                    <div className="health-explanation-grid">
                      <section>
                        <span className="health-label">Likely cause</span>
                        <p>{aiDiagnosis?.likelyCause || selectedIncident.likelyCause}</p>
                      </section>
                      <section>
                        <span className="health-label">Operational impact</span>
                        <p>{aiDiagnosis?.impact || selectedIncident.impact}</p>
                      </section>
                      <section>
                        <span className="health-label">Confidence</span>
                        <p>{aiDiagnosis ? formatStatusLabel(aiDiagnosis.confidence) : "Evidence-based initial assessment"}</p>
                      </section>
                    </div>

                    <section className="health-diagnosis-block">
                      <div className="health-block-title">
                        <Activity size={19} aria-hidden="true" />
                        <h3>Evidence from the latest check</h3>
                      </div>
                      <div className="health-evidence-list">
                        {selectedIncident.evidence.map((entry, index) => (
                          <div className="health-evidence-row" key={`${entry.label}-${index}`}>
                            <div>
                              <strong>{entry.label}</strong>
                              {entry.detail ? <span>{entry.detail}</span> : null}
                              {entry.url ? <code>{entry.url}</code> : null}
                            </div>
                            <span>{entry.checkedAt ? formatDateTime(entry.checkedAt) : "Latest probe"}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="health-diagnosis-block">
                      <div className="health-block-title">
                        <DocumentText size={19} aria-hidden="true" />
                        <h3>Recovery runbook</h3>
                      </div>
                      <ol className="health-runbook">
                        {(aiDiagnosis?.actions || selectedIncident.actions).map((action, index) => (
                          <li key={`${action.title}-${index}`}>
                            <span>{index + 1}</span>
                            <div>
                              <strong>{action.title}</strong>
                              <p>{action.instruction || action.detail}</p>
                              {action.urgency ? <small>{formatStatusLabel(action.urgency)}</small> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>

                    {aiDiagnosis ? (
                      <section className="health-ai-result" aria-live="polite">
                        <div className="health-block-title">
                          <Magicpen size={19} aria-hidden="true" />
                          <h3>AI operational assessment</h3>
                        </div>
                        <p>{aiDiagnosis.executiveSummary}</p>
                        <div>
                          <strong>Verify recovery</strong>
                          <ul>{aiDiagnosis.verificationSteps.map((step) => <li key={step}>{step}</li>)}</ul>
                        </div>
                        <div>
                          <strong>Escalation point</strong>
                          <p>{aiDiagnosis.escalation}</p>
                        </div>
                      </section>
                    ) : null}
                    {aiError ? <div className="notice is-warning" role="alert">{aiError} The evidence-based runbook above remains available.</div> : null}

                    <section className="health-diagnosis-block" id="incident-notes">
                      <div className="health-block-title">
                        <DocumentText size={19} aria-hidden="true" />
                        <h3>Incident notes</h3>
                      </div>
                      <form className="health-note-form" onSubmit={handleAddNote}>
                        <label htmlFor="incidentNote">Add an observation or recovery update</label>
                        <textarea
                          id="incidentNote"
                          className="input"
                          rows={3}
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          placeholder="Example: Railway logs show a missing migration; deployment restarted at 14:20."
                        />
                        <button className="button button-ghost" type="submit" disabled={!noteDraft.trim()}>
                          <DocumentText size={18} aria-hidden="true" />
                          <span>Add note</span>
                        </button>
                      </form>
                      {selectedNotes.length ? (
                        <div className="health-note-list">
                          {selectedNotes.map((note) => (
                            <div key={note.id}>
                              <p>{note.text}</p>
                              <span>{formatDateTime(note.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="muted">No notes for this incident yet.</p>}
                    </section>
                  </>
                ) : null}
              </section>
            </div>
          ) : (
            <section className="health-section health-clear-state">
              <TickCircle size={30} aria-hidden="true" />
              <div>
                <h2>No active incidents</h2>
                <p>Every configured monitor returned a healthy signal in the latest check.</p>
              </div>
            </section>
          )}

          <section className="health-section health-inventory">
            <div className="health-section__header">
              <div>
                <p className="eyebrow">Monitor inventory</p>
                <h2>Every tracked service</h2>
                <p className="muted">Use this list to confirm coverage and inspect individual route evidence.</p>
              </div>
              <Monitor size={24} aria-hidden="true" />
            </div>
            <div className="health-inventory-list">
              {monitors.map((monitor) => {
                const configured = (monitor.checks || []).filter((check) => String(check?.status).toLowerCase() !== "not_configured");
                const healthy = configured.filter((check) => isMonitorHealthy(check?.status));
                const incident = incidents.find((item) => item.monitorId === monitor.id);
                return (
                  <details className="health-inventory-row" key={monitor.id}>
                    <summary>
                      <span className={`health-inventory-row__indicator is-${getStatusTone(monitor.status)}`} />
                      <span className="health-inventory-row__identity">
                        <strong>{monitor.label}</strong>
                        <small>{monitor.category} · {monitor.note}</small>
                      </span>
                      <span className="health-inventory-row__coverage">
                        {monitor.checks.length ? `${healthy.length}/${configured.length || monitor.checks.length} checks healthy` : "Connection probe"}
                      </span>
                      <StatusBadge status={monitor.status} />
                    </summary>
                    <div className="health-inventory-row__detail">
                      {monitor.checks.length ? monitor.checks.map((check) => (
                        <div className="health-check-row" key={check.url || `${monitor.id}-${check.path}`}>
                          <div>
                            <strong>{check.label || check.path}</strong>
                            <code>{check.finalUrl || check.url || "URL not configured"}</code>
                          </div>
                          <span>{formatCheckEvidence(check)}</span>
                          <StatusBadge status={check.status} />
                        </div>
                      )) : <p>{monitor.note}. The dashboard performs a database connection and schema probe.</p>}
                      {incident ? (
                        <button className="button button-ghost" type="button" onClick={() => selectMonitorIncident(monitor.id)}>
                          <ArrowRight2 size={18} aria-hidden="true" />
                          <span>View diagnosis</span>
                        </button>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
};

export default SystemHealth;
