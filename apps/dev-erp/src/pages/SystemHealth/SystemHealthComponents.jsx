import React, { useEffect, useRef } from "react";
import { Activity, CloseCircle, Refresh2, SearchNormal1, TickCircle } from "iconsax-react";
import { ERPStatusBadge, SelectField } from "@faako/ui";
import { formatDateTime } from "../../utils/formatters";
import { buildMonitoringFilterOptions, MONITORING_SECTIONS, normalizeHealthStatus, TIMELINE_RANGES } from "./monitoringConfig";

const STATUS_LABELS = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
  checking: "Checking",
};

const STATUS_TONES = {
  healthy: "success",
  degraded: "warning",
  down: "danger",
  unknown: "info",
  checking: "info",
};

export const StatusBadge = ({ status }) => {
  const normalized = normalizeHealthStatus(status);
  return (
    <ERPStatusBadge tone={STATUS_TONES[normalized]} className={`health-status-badge is-${normalized}`}>
      <span className="health-status-badge__dot" aria-hidden="true" />
      {STATUS_LABELS[normalized]}
    </ERPStatusBadge>
  );
};

export const LatencyBadge = ({ value }) => {
  const tone = !Number.isFinite(value) ? "unknown" : value > 500 ? "slow" : value > 250 ? "medium" : "fast";
  return <span className={`health-latency is-${tone}`}>{Number.isFinite(value) ? `${value} ms` : "No data"}</span>;
};

export const TimelineBlock = ({ block, serviceName }) => {
  const statusLabel = STATUS_LABELS[normalizeHealthStatus(block.status)];
  const tooltip = [
    formatDateTime(block.timestamp),
    statusLabel,
    Number.isFinite(block.latencyMs) ? `${block.latencyMs} ms` : "No latency",
    block.httpStatus ? `HTTP ${block.httpStatus}` : "No HTTP status",
    block.duration,
  ].join(" · ");
  return (
    <button
      className={`health-timeline-block is-${normalizeHealthStatus(block.status)}`}
      type="button"
      aria-label={`${serviceName}: ${tooltip}`}
      data-tooltip={tooltip}
    />
  );
};

export const HealthTimeline = ({ timeline, serviceName, compact = false }) => (
  <div className={`health-timeline ${compact ? "is-compact" : ""}`} aria-label={`${serviceName} health timeline`}>
    {timeline.map((block) => <TimelineBlock block={block} serviceName={serviceName} key={block.id} />)}
  </div>
);

export const TimelineRangeSelector = ({ value, onChange }) => (
  <div className="health-range-selector" role="group" aria-label="Timeline range">
    {TIMELINE_RANGES.map((range) => (
      <button
        className={value === range.value ? "is-active" : ""}
        type="button"
        aria-pressed={value === range.value}
        onClick={() => onChange(range.value)}
        key={range.value}
      >
        {range.label}
      </button>
    ))}
  </div>
);

export const PlatformHealthScore = ({ summary }) => (
  <section className="health-score-card" aria-label={Number.isFinite(summary.score) ? `Platform health score ${summary.score} percent` : "Platform health score unavailable"}>
    <div className="health-score-card__ring" style={{ "--health-score": `${Number.isFinite(summary.score) ? summary.score * 3.6 : 0}deg` }}>
      <span><strong>{Number.isFinite(summary.score) ? summary.score : "--"}</strong><small>{Number.isFinite(summary.score) ? "/ 100" : "score"}</small></span>
    </div>
    <div>
      <p className="eyebrow">Overall summary</p>
      <h2>{!Number.isFinite(summary.score) ? "Monitoring coverage is incomplete" : summary.down ? "Platform needs attention" : summary.degraded ? "Platform is operational" : "All systems operational"}</h2>
      <p>{!Number.isFinite(summary.score) ? `${summary.coveragePercentage}% of registered services currently have a usable signal.` : summary.down ? `${summary.down} service${summary.down === 1 ? "" : "s"} unavailable.` : summary.degraded ? `${summary.degraded} service${summary.degraded === 1 ? "" : "s"} currently degraded.` : "All monitored services are responding normally."}</p>
    </div>
  </section>
);

export const MonitoringSummaryCards = ({ summary }) => {
  const cards = [
    ["Healthy services", `${summary.healthy}/${summary.total}`, "success"],
    ["Degraded", summary.degraded, "warning"],
    ["Down", summary.down, "danger"],
    ["Avg. latency", summary.averageLatencyMs ? `${summary.averageLatencyMs} ms` : "N/A", "info"],
    ["Active incidents", summary.activeIncidents, summary.activeIncidents ? "warning" : "success"],
  ];
  return (
    <div className="health-summary-cards">
      {cards.map(([label, value, tone]) => (
        <article className={`health-summary-card is-${tone}`} key={label}>
          <span>{label}</span><strong>{value}</strong>
        </article>
      ))}
    </div>
  );
};

export const MonitoringFilters = ({ filters, onChange, providers, environments }) => (
  <section className="health-filter-panel" aria-label="Monitoring filters">
    <label className="field health-filter-search">
      <span>Search</span>
      <span className="health-filter-search__control">
        <SearchNormal1 size={17} aria-hidden="true" />
        <input className="input" type="search" value={filters.search} onChange={(event) => onChange("search", event.target.value)} placeholder="Search services or providers" />
      </span>
    </label>
    <SelectField fieldClassName="field" label="Environment" value={filters.environment} options={buildMonitoringFilterOptions(environments?.length ? environments : ["development", "production"], "All environments")} onChange={(event) => onChange("environment", event.target.value)} />
    <SelectField fieldClassName="field" label="Status" value={filters.status} options={buildMonitoringFilterOptions(["healthy", "degraded", "down", "unknown", "checking"], "All statuses")} onChange={(event) => onChange("status", event.target.value)} />
    <SelectField fieldClassName="field" label="Category" value={filters.category} options={buildMonitoringFilterOptions(MONITORING_SECTIONS, "All categories")} onChange={(event) => onChange("category", event.target.value)} />
    <SelectField fieldClassName="field" label="Provider" value={filters.provider} options={buildMonitoringFilterOptions(providers, "All providers")} onChange={(event) => onChange("provider", event.target.value)} />
  </section>
);

export const ServiceRow = ({ service, onSelect }) => (
  <div className="health-service-row">
    <button className="health-service-row__identity health-service-row__open" type="button" onClick={() => onSelect(service)} aria-label={`Open details for ${service.name}`}>
      <span className={`health-service-icon is-${normalizeHealthStatus(service.status)}`}><Activity size={18} aria-hidden="true" /></span>
      <span><strong>{service.name}</strong><small>{service.environment} · {service.provider}</small></span>
    </button>
    <StatusBadge status={service.status} />
    <LatencyBadge value={service.latencyMs} />
    <HealthTimeline timeline={service.timeline} serviceName={service.name} />
    <span className="health-service-row__uptime"><strong>{Number.isFinite(service.uptimePercentage) ? `${service.uptimePercentage}%` : "--"}</strong><small>uptime</small></span>
  </div>
);

export const MonitoringSection = ({ section, services, onSelect }) => {
  if (!services.length) return null;
  const healthy = services.filter((service) => normalizeHealthStatus(service.status) === "healthy").length;
  return (
    <section className="health-monitoring-section" aria-labelledby={`health-section-${section.id}`}>
      <header>
        <div><h2 id={`health-section-${section.id}`}>{section.label}</h2><p>{section.description}</p></div>
        <span>{healthy}/{services.length} healthy</span>
      </header>
      <div className="health-service-table">
        <div className="health-service-table__head" aria-hidden="true"><span>Service</span><span>Status</span><span>Latency</span><span>History</span><span>Uptime</span></div>
        {services.map((service) => <ServiceRow service={service} onSelect={onSelect} key={service.id} />)}
      </div>
    </section>
  );
};

export const DependencyTree = ({ dependencies, serviceMap }) => (
  <div className="health-dependency-tree">
    {dependencies.length ? dependencies.map((id) => {
      const dependency = serviceMap.get(id);
      return dependency ? <div key={id}><span aria-hidden="true" /><strong>{dependency.name}</strong><StatusBadge status={dependency.status} /></div> : null;
    }) : <p>No downstream dependencies configured.</p>}
  </div>
);

export const IncidentList = ({ incidents }) => (
  <div className="health-drawer-incidents">
    {incidents.length ? incidents.map((incident) => (
      <article key={incident.id}><span className="health-incident-marker" aria-hidden="true" /><div><strong>{incident.title}</strong><p>{formatDateTime(incident.startedAt)} · {incident.status}</p></div></article>
    )) : <div className="health-drawer-empty"><TickCircle size={20} aria-hidden="true" /><span>No recent incidents</span></div>}
  </div>
);

export const ServiceDrawer = ({ service, serviceMap, onClose, onManualCheck, isChecking, canRunManualCheck, manualCheckError }) => {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!service) return undefined;
    closeRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [service, onClose]);
  if (!service) return null;
  const metrics = [
    ["Current", service.latencyMs], ["Average", service.averageLatencyMs], ["Minimum", service.minLatencyMs], ["Maximum", service.maxLatencyMs], ["P95", service.p95LatencyMs],
  ];
  return (
    <div className="health-drawer-shell" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="health-service-drawer" role="dialog" aria-modal="true" aria-labelledby="service-drawer-title">
        <header>
          <div><p className="eyebrow">Service detail</p><h2 id="service-drawer-title">{service.name}</h2><p>{service.environment} · {service.provider}</p></div>
          <button className="health-drawer-close" type="button" onClick={onClose} ref={closeRef} aria-label="Close service details"><CloseCircle size={24} aria-hidden="true" /></button>
        </header>
        <div className="health-drawer-content">
          <section className="health-drawer-current"><div><StatusBadge status={isChecking ? "checking" : service.effectiveStatus} />{service.directStatus !== service.effectiveStatus ? <small>Direct: {STATUS_LABELS[service.directStatus]}</small> : null}</div><span>Uptime <strong>{Number.isFinite(service.uptimePercentage) ? `${service.uptimePercentage}%` : "N/A"}</strong></span></section>
          <section><h3>Latency</h3><div className="health-drawer-metrics">{metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{Number.isFinite(value) ? `${value} ms` : "N/A"}</strong></div>)}</div></section>
          <section><h3>Historical timeline</h3><HealthTimeline timeline={service.timeline} serviceName={service.name} /><p className="health-drawer-trend">Latency trend: <strong>{service.latencyTrend}</strong></p></section>
          <section><h3>Latest checks</h3><dl className="health-check-times"><div><dt>Last checked</dt><dd>{formatDateTime(service.lastCheckedAt)}</dd></div><div><dt>Last successful</dt><dd>{formatDateTime(service.lastSuccessfulCheck)}</dd></div><div><dt>Last failed</dt><dd>{service.lastFailedCheck ? formatDateTime(service.lastFailedCheck) : "None in range"}</dd></div></dl></section>
          <section><h3>Dependencies</h3><DependencyTree dependencies={service.dependencies} serviceMap={serviceMap} /></section>
          <section><h3>Recent incidents</h3><IncidentList incidents={service.incidents} /></section>
          <section className="health-metrics-placeholder"><h3>Metrics coverage</h3><div><Activity size={24} aria-hidden="true" /><p>Current, minimum, maximum, average, P95, uptime, and trend are calculated for the selected range.</p></div></section>
        </div>
        <footer>{manualCheckError ? <div className="notice is-error" role="alert">{manualCheckError}</div> : null}<button className="button button-primary" type="button" onClick={onManualCheck} disabled={isChecking || !canRunManualCheck}><Refresh2 size={18} aria-hidden="true" />{isChecking ? "Checking..." : "Run manual health check"}</button><small>{canRunManualCheck ? "Runs the trusted server-side check and records an audit event." : "Administrator access is required for manual checks."}</small></footer>
      </aside>
    </div>
  );
};

export const SkeletonRow = () => <div className="health-skeleton-row" aria-hidden="true"><span /><span /><span /></div>;

export const EmptyState = ({ onReset }) => (
  <section className="health-empty-state"><SearchNormal1 size={28} aria-hidden="true" /><h2>No services match these filters</h2><p>Try a broader search or reset the monitoring filters.</p><button className="button button-ghost" type="button" onClick={onReset}>Reset filters</button></section>
);
