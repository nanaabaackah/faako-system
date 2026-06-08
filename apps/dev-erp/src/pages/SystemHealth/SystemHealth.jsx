import React, { useEffect, useMemo, useState } from "react";
import { AnimatedLoadingState, ERPStatusBadge } from "@faako/ui";
import MonitoringSparkline from "../../components/MonitoringSparkline/MonitoringSparkline";
import {
  buildMonitoringSparklineValues,
  getMonitoringHealthScore,
  getMonitoringStatusSummary,
  getMonitoringTone,
} from "../../components/MonitoringSparkline/monitoringSparklineUtils";
import useDashboardData from "../../hooks/useDashboardData";
import { formatDateTime, formatPercent, formatRatio } from "../../utils/formatters";
import { getAggregateSiteStatus } from "../../utils/siteStatus";
import { formatStatusLabel, getStatusTone, isHealthyStatus } from "../../utils/status";

const INCIDENT_NOTES_KEY = "dev-incident-notes";
const INCIDENT_NOTE_DISMISSED_KEY = "dev-incident-note-dismissed";

const readStoredJsonArray = (storageKey) => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(storageKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toIncidentKey = (item) => `${item.id}:${item.status}`;

const buildAutomaticIncidentNote = (item) => {
  const statusLabel = formatStatusLabel(item.status).toLowerCase();
  return `${item.label} marked ${statusLabel}. ${item.note}`;
};

const SystemHealth = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [noteDraft, setNoteDraft] = useState("");
  const [incidentNotes, setIncidentNotes] = useState(() => readStoredJsonArray(INCIDENT_NOTES_KEY));
  const [dismissedIncidentKeys, setDismissedIncidentKeys] = useState(() =>
    readStoredJsonArray(INCIDENT_NOTE_DISMISSED_KEY)
  );

  useEffect(() => {
    localStorage.setItem(INCIDENT_NOTES_KEY, JSON.stringify(incidentNotes));
  }, [incidentNotes]);

  useEffect(() => {
    localStorage.setItem(INCIDENT_NOTE_DISMISSED_KEY, JSON.stringify(dismissedIncidentKeys));
  }, [dismissedIncidentKeys]);

  const renderStatusPill = (status) => {
    const tone = getStatusTone(status);
    return (
      <ERPStatusBadge tone={tone} className={`status-pill is-${tone}`}>
        {formatStatusLabel(status)}
      </ERPStatusBadge>
    );
  };

  const systemStatus = kpiData?.status ?? {};
  const rawSiteStatuses = kpiData?.siteStatus?.sites;
  const apiSurfaces = useMemo(
    () =>
      Array.isArray(kpiData?.apiSurfaces)
        ? kpiData.apiSurfaces
        : [
            {
              id: "dev-erp-api",
              label: "Dev ERP API",
              status: systemStatus.api,
              note: "API surface",
            },
            {
              id: "faako-api",
              label: "Faako API",
              status: systemStatus.faakoApi,
              note: "API surface",
            },
            {
              id: "stroane-api",
              label: "Stroane API",
              status: systemStatus.stroaneApi,
              note: "API surface",
            },
          ].filter((surface) => surface.status),
    [kpiData?.apiSurfaces, systemStatus.api, systemStatus.faakoApi, systemStatus.stroaneApi]
  );
  const siteStatuses = useMemo(
    () => (Array.isArray(rawSiteStatuses) ? rawSiteStatuses : []),
    [rawSiteStatuses]
  );
  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const lastCheckedLabel = kpiData?.siteStatus?.checkedAt
    ? formatDateTime(kpiData.siteStatus.checkedAt)
    : "N/A";

  const systemEntries = useMemo(
    () => [
      ...apiSurfaces.map((surface) => ({
        id: surface.id,
        label: surface.label,
        status: surface.status,
        note: surface.note || "API surface",
      })),
      {
        id: "portfolio",
        label: "Primary DB",
        status: systemStatus.portfolioDb,
        note: "Core organization data",
      },
      {
        id: "reebs",
        label: "Reebs DB",
        status: systemStatus.reebsDb,
        note: "Operational data",
      },
      {
        id: "faako",
        label: "Faako DB",
        status: systemStatus.faakoDb,
        note: "ERP members",
      },
      {
        id: "stroane",
        label: "Stroane DB",
        status: systemStatus.stroaneDb,
        note: "Client commerce data",
      },
    ],
    [
      apiSurfaces,
      systemStatus.faakoDb,
      systemStatus.portfolioDb,
      systemStatus.reebsDb,
      systemStatus.stroaneDb,
    ]
  );

  const siteOverview = useMemo(
    () =>
      siteStatuses.map((site) => {
        const pages = site.pages ?? [];
        const aggregateStatus = getAggregateSiteStatus(pages);
        const summary = getMonitoringStatusSummary(pages);
        const score = aggregateStatus === "not_configured"
          ? 0
          : summary.configured
            ? summary.score
            : getMonitoringHealthScore(aggregateStatus);
        return {
          id: site.id,
          title: site.title,
          category: site.category,
          pages,
          aggregateStatus,
          summary,
          score,
          tone: getMonitoringTone(aggregateStatus),
          sparkline: buildMonitoringSparklineValues({
            status: aggregateStatus,
            score,
            seed: site.title?.length || site.id?.length || 1,
          }),
        };
      }),
    [siteStatuses]
  );

  const sitePages = siteOverview.flatMap((site) => site.pages);
  const totalServices = systemEntries.filter((entry) => entry.status).length;
  const healthyServices = systemEntries.filter(
    (entry) => entry.status && isHealthyStatus(entry.status)
  ).length;
  const configuredSites = siteOverview.filter((site) => site.aggregateStatus !== "not_configured");
  const totalSites = configuredSites.length;
  const onlineSites = siteOverview.filter((site) => site.aggregateStatus === "online").length;
  const configuredPages = sitePages.filter((page) => page.status !== "not_configured");
  const totalPages = configuredPages.length;
  const onlinePages = sitePages.filter((page) => page.status === "online").length;
  const serviceHealthPercent = formatPercent(healthyServices, totalServices);
  const siteHealthPercent = formatPercent(onlineSites, totalSites);
  const pageHealthPercent = formatPercent(onlinePages, totalPages);
  const systemMonitorEntries = systemEntries.map((entry, index) => {
    const score = getMonitoringHealthScore(entry.status);
    return {
      ...entry,
      score,
      tone: getMonitoringTone(entry.status),
      sparkline: buildMonitoringSparklineValues({
        status: entry.status,
        score,
        seed: index + entry.label.length,
      }),
    };
  });
  const snapshotCards = [
    {
      id: "services",
      label: "Services healthy",
      value: `${serviceHealthPercent}%`,
      detail: formatRatio(healthyServices, totalServices),
      helper: `${totalServices} services tracked`,
      status: healthyServices === totalServices ? "online" : healthyServices ? "degraded" : "offline",
      score: serviceHealthPercent,
      seed: 2,
    },
    {
      id: "surfaces",
      label: "Surfaces online",
      value: `${siteHealthPercent}%`,
      detail: formatRatio(onlineSites, totalSites),
      helper: `${totalSites} configured surfaces`,
      status: onlineSites === totalSites ? "online" : onlineSites ? "degraded" : "offline",
      score: siteHealthPercent,
      seed: 7,
    },
    {
      id: "pages",
      label: "Pages online",
      value: `${pageHealthPercent}%`,
      detail: formatRatio(onlinePages, totalPages),
      helper: `${totalPages} configured pages`,
      status: onlinePages === totalPages ? "online" : onlinePages ? "degraded" : "offline",
      score: pageHealthPercent,
      seed: 11,
    },
  ].map((card) => ({
    ...card,
    tone: getMonitoringTone(card.status),
    sparkline: buildMonitoringSparklineValues({
      status: card.status,
      score: card.score,
      seed: card.seed,
    }),
  }));

  const attentionItems = useMemo(
    () => [
      ...systemEntries
        .filter((entry) => entry.status && !isHealthyStatus(entry.status))
        .map((entry) => ({
          id: `system-${entry.id}`,
          label: entry.label,
          status: entry.status,
          note: entry.note,
        })),
      ...siteOverview
        .filter(
          (site) => site.aggregateStatus === "offline" || site.aggregateStatus === "degraded"
        )
        .map((site) => ({
          id: `site-${site.id}`,
          label: site.title,
          status: site.aggregateStatus,
          note: `${site.pages.length} pages tracked`,
        })),
    ],
    [siteOverview, systemEntries]
  );

  useEffect(() => {
    const activeIncidentKeys = attentionItems.map(toIncidentKey);
    setDismissedIncidentKeys((prev) => {
      const next = prev.filter((incidentKey) => activeIncidentKeys.includes(incidentKey));
      return next.length === prev.length ? prev : next;
    });
  }, [attentionItems]);

  useEffect(() => {
    if (!attentionItems.length) return;

    setIncidentNotes((prev) => {
      const existingIncidentKeys = new Set(
        prev
          .map((note) => String(note?.incidentKey || "").trim())
          .filter(Boolean)
      );
      const suppressedIncidentKeys = new Set(
        dismissedIncidentKeys.map((incidentKey) => String(incidentKey || "").trim()).filter(Boolean)
      );
      const createdAt = new Date().toISOString();
      const automaticNotes = attentionItems
        .filter((item) => {
          const incidentKey = toIncidentKey(item);
          return (
            !existingIncidentKeys.has(incidentKey) &&
            !suppressedIncidentKeys.has(incidentKey)
          );
        })
        .map((item) => ({
          id: `incident-${item.id}-${item.status}-${Date.now()}`,
          text: buildAutomaticIncidentNote(item),
          createdAt,
          incidentKey: toIncidentKey(item),
          kind: "auto",
        }));

      return automaticNotes.length ? [...automaticNotes, ...prev] : prev;
    });
  }, [attentionItems, dismissedIncidentKeys]);

  const handleAddNote = (event) => {
    event.preventDefault();
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    const newNote = {
      id: `${Date.now()}`,
      text: trimmed,
      createdAt: new Date().toISOString(),
      kind: "manual",
    };
    setIncidentNotes((prev) => [newNote, ...prev]);
    setNoteDraft("");
  };

  const handleClearNotes = () => {
    setDismissedIncidentKeys(attentionItems.map(toIncidentKey));
    setIncidentNotes([]);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">System operations</p>
          <h1>System health</h1>
          <p className="muted">
            Last synced {lastSyncedLabel} | Site check {lastCheckedLabel}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => reload({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <a className="button button-ghost" href="#incident-notes">
            Incident notes
          </a>
        </div>
      </header>

      {loading ? (
        <AnimatedLoadingState compact className="panel" title="Loading system health" />
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {kpiData ? (
        <div className="page-grid">
          <div className="stack">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Monitoring snapshot</h3>
                  <p className="muted">Health ratios and current signal shape.</p>
                </div>
              </div>
              <div className="monitoring-card-grid">
                {snapshotCards.map((card) => (
                  <article className={`monitoring-card is-${card.tone}`} key={card.id}>
                    <div className="monitoring-card__header">
                      <div className="monitoring-card__title">
                        <span className="kpi-label">{card.label}</span>
                        <strong>{card.detail}</strong>
                      </div>
                      {renderStatusPill(card.status)}
                    </div>
                    <div className="monitoring-card__metric">
                      <strong>{card.value}</strong>
                      <span>uptime</span>
                    </div>
                    <div
                      className="monitoring-card__rail"
                      style={{ "--monitoring-score": `${card.score}%` }}
                      aria-hidden="true"
                    >
                      <span />
                    </div>
                    <div className="monitoring-card__spark">
                      <MonitoringSparkline
                        values={card.sparkline}
                        status={card.status}
                        label={`${card.label} sparkline`}
                      />
                    </div>
                    <div className="monitoring-card__footer">
                      <span className="muted">{card.helper}</span>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Service status</h3>
                  <p className="muted">API and database checks with compact telemetry.</p>
                </div>
              </div>
              <div className="monitoring-card-grid">
                {systemMonitorEntries.map((row) => (
                  <article className={`monitoring-card is-${row.tone}`} key={row.id}>
                    <div className="monitoring-card__header">
                      <div className="monitoring-card__title">
                        <strong>{row.label}</strong>
                        <span className="muted">{row.note}</span>
                      </div>
                      {renderStatusPill(row.status)}
                    </div>
                    <div className="monitoring-card__metric">
                      <strong>{row.score}</strong>
                      <span>score</span>
                    </div>
                    <div className="monitoring-card__spark">
                      <MonitoringSparkline
                        values={row.sparkline}
                        status={row.status}
                        label={`${row.label} health sparkline`}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <section className="panel site-status" id="site-health">
              <div className="panel-header">
                <div>
                  <h3>Website and portal health</h3>
                  <p className="muted">Last refreshed {lastCheckedLabel}.</p>
                </div>
              </div>
              <div className="site-grid">
                {siteOverview.length ? (
                  siteOverview.map((site) => (
                    <article key={site.id} className={`site-card site-card--static is-${site.tone}`}>
                      <div className="site-card__header">
                        <div className="site-card__meta">
                          <span className="table-strong">{site.title}</span>
                          <span className="muted">
                            {site.aggregateStatus === "not_configured"
                              ? "URL not configured"
                              : `${site.summary.configured}/${site.summary.total} endpoints configured`}
                          </span>
                        </div>
                        <div className="site-card__actions">
                          {renderStatusPill(site.aggregateStatus)}
                        </div>
                      </div>
                      <div className="site-card__telemetry">
                        <div className="site-card__score">
                          <strong>
                            {site.aggregateStatus === "not_configured" ? "--" : `${site.score}%`}
                          </strong>
                          <span>surface score</span>
                        </div>
                        <div className="site-card__spark">
                          <MonitoringSparkline
                            values={site.sparkline}
                            status={site.aggregateStatus}
                            label={`${site.title} health sparkline`}
                          />
                        </div>
                      </div>
                      <div className="site-card__chips" aria-label={`${site.title} endpoint mix`}>
                        <span className="site-card__chip is-success">
                          {site.summary.online} online
                        </span>
                        {site.summary.degraded ? (
                          <span className="site-card__chip is-warning">
                            {site.summary.degraded} degraded
                          </span>
                        ) : null}
                        {site.summary.offline ? (
                          <span className="site-card__chip is-danger">
                            {site.summary.offline} offline
                          </span>
                        ) : null}
                        {site.summary.notConfigured ? (
                          <span className="site-card__chip">
                            {site.summary.notConfigured} missing URL
                          </span>
                        ) : null}
                      </div>
                      <div className="site-card__list">
                        {site.pages.map((page) => (
                          <div className="site-card__row" key={page.url || `${site.id}:${page.path}`}>
                            <span>{page.url ? page.label : `${page.label} URL`}</span>
                            {renderStatusPill(page.status)}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">No site checks yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="stack">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Attention required</h3>
                  <p className="muted">Items needing a quick check.</p>
                </div>
              </div>
              <div className="list">
                {attentionItems.length ? (
                  attentionItems.map((item) => (
                    <div className="list-row is-split" key={item.id}>
                      <div className="table-cell-stack">
                        <span className="table-strong">{item.label}</span>
                        <span className="muted">{item.note}</span>
                      </div>
                      {renderStatusPill(item.status)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No alerts right now.</p>
                )}
              </div>
            </article>

            <article className="panel" id="incident-notes">
              <div className="panel-header">
                <div>
                  <h3>Incident notes</h3>
                  <p className="muted">Track observations during incidents.</p>
                </div>
              </div>
              <form className="stack" onSubmit={handleAddNote}>
                <label className="form-field" htmlFor="incidentNote">
                  <span>New note</span>
                  <textarea
                    id="incidentNote"
                    className="input"
                    placeholder="Add a short incident summary or next step."
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                </label>
                <div className="header-actions">
                  <button className="button button-primary" type="submit">
                    Add note
                  </button>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={handleClearNotes}
                    disabled={!incidentNotes.length}
                  >
                    Clear notes
                  </button>
                </div>
              </form>
              <div className="list">
                {incidentNotes.length ? (
                  incidentNotes.map((note) => (
                    <div className="list-row" key={note.id}>
                      <div className="table-cell-stack">
                        <span className="table-strong">{note.text}</span>
                        {note.kind === "auto" ? (
                          <span className="muted">Automatic incident note</span>
                        ) : null}
                      </div>
                      <span className="muted">{formatDateTime(note.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No incident notes yet.</p>
                )}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default SystemHealth;
