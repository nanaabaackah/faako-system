import React, { useCallback, useMemo, useState } from "react";
import { Refresh2 } from "iconsax-react";
import { formatDateTime } from "../../utils/formatters";
import { readStoredSessionUser } from "../../utils/authSession";
import {
  EmptyState,
  MonitoringFilters,
  MonitoringSection,
  MonitoringSummaryCards,
  PlatformHealthScore,
  ServiceDrawer,
  SkeletonRow,
  TimelineRangeSelector,
} from "./SystemHealthComponents";
import {
  adaptMonitoringService,
  filterServices,
  getPlatformSummary,
  MONITORING_SECTIONS,
  TIMELINE_RANGES,
} from "./monitoringConfig";
import { useMonitoringData } from "./useMonitoringData";
import { useIncidentResponse } from "./useIncidentResponse";
import { ActiveMaintenanceBanner, IncidentResponsePanel } from "./IncidentResponseComponents";
import "./SystemHealth.css";

const DEFAULT_FILTERS = { search: "", environment: "all", status: "all", category: "all", provider: "all" };

const SystemHealthHeader = ({ range, onRangeChange, onRefresh, checking, lastUpdatedAt }) => {
  const interval = TIMELINE_RANGES.find((item) => item.value === range)?.interval;
  return (
    <header className="page-header system-health-header">
      <div><p className="eyebrow">System operations</p><h1>System health</h1><p className="muted">Monitor service availability, latency, dependencies, and incidents across the platform.</p></div>
      <div className="system-health-header__actions">
        <TimelineRangeSelector value={range} onChange={onRangeChange} />
        <button className="button button-ghost" type="button" onClick={onRefresh} disabled={checking}><Refresh2 size={18} aria-hidden="true" />{checking ? "Refreshing..." : "Refresh"}</button>
        <small><span className="health-live-dot" aria-hidden="true" /> Live · {interval} intervals{lastUpdatedAt ? ` · Updated ${formatDateTime(lastUpdatedAt)}` : ""}</small>
      </div>
    </header>
  );
};

const SystemHealth = () => {
  const [range, setRange] = useState("day");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [checkingServiceId, setCheckingServiceId] = useState(null);
  const [manualCheckError, setManualCheckError] = useState("");
  const { data, loading, refreshing, error, partialErrors, lastUpdatedAt, reload, runManualCheck } = useMonitoringData(range);
  const services = useMemo(() => (Array.isArray(data?.services) ? data.services.map((service) => adaptMonitoringService(service, range)) : []), [data?.services, range]);
  const summary = useMemo(() => getPlatformSummary(services, data?.summary), [data?.summary, services]);
  const visibleServices = useMemo(() => filterServices(services, filters), [filters, services]);
  const serviceMap = useMemo(() => {
    const map = new Map();
    services.forEach((service) => { map.set(service.id, service); map.set(service.key, service); });
    return map;
  }, [services]);
  const selectedService = serviceMap.get(selectedServiceId) || null;
  const providers = useMemo(() => [...new Set(services.map((service) => service.provider).filter(Boolean))].sort(), [services]);
  const user = useMemo(() => readStoredSessionUser(), []);
  const canRunManualCheck = (user?.roleName || user?.role?.name) === "Admin";
  const incidentCapabilities = user?.role?.permissions?.capabilities || user?.capabilities || [];
  const canViewIncidents = canRunManualCheck || incidentCapabilities.includes("INCIDENT_VIEW");
  const canManageIncidents = canRunManualCheck || incidentCapabilities.some((capability) => ["INCIDENT_ACKNOWLEDGE", "INCIDENT_ASSIGN", "INCIDENT_UPDATE", "INCIDENT_RESOLVE", "ALERT_RULE_MANAGE", "MAINTENANCE_WINDOW_MANAGE"].includes(capability));
  const incidentResponse = useIncidentResponse({ enabled: canViewIncidents, canManage: canManageIncidents });

  const handleFilterChange = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const closeDrawer = useCallback(() => { setSelectedServiceId(null); setManualCheckError(""); }, []);
  const handleManualCheck = async () => {
    if (!selectedService || !canRunManualCheck) return;
    setCheckingServiceId(selectedService.id);
    setManualCheckError("");
    try {
      await runManualCheck(selectedService.id);
    } catch (requestError) {
      setManualCheckError(requestError.message || "Unable to run the manual health check.");
    } finally {
      setCheckingServiceId(null);
    }
  };

  return (
    <section className="page system-health-page">
      <SystemHealthHeader range={range} onRangeChange={setRange} onRefresh={() => reload({ silent: true })} checking={refreshing} lastUpdatedAt={lastUpdatedAt} />
      {error ? <div className={`notice ${services.length ? "is-warning" : "is-error"}`} role="alert">{error} <button className="button button-ghost" type="button" onClick={() => reload()}>Retry</button></div> : null}
      {partialErrors.length ? <div className="notice is-warning" role="status">Some monitoring sections could not be refreshed. Available service data is shown below.</div> : null}
      {canViewIncidents ? <ActiveMaintenanceBanner windows={incidentResponse.maintenanceWindows} /> : null}
      {loading && !services.length ? <section className="health-loading-state" aria-label="Loading system health"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></section> : null}
      {services.length ? (
        <>
          <div className="health-overall-grid"><PlatformHealthScore summary={summary} /><MonitoringSummaryCards summary={summary} /></div>
          {canViewIncidents ? <IncidentResponsePanel response={incidentResponse} services={services} canManage={canManageIncidents} /> : null}
          <MonitoringFilters filters={filters} onChange={handleFilterChange} providers={providers} environments={[...new Set(services.map((service) => service.environment))]} />
          <div className="health-monitoring-stack">
            {visibleServices.length ? MONITORING_SECTIONS.map((section) => (
              <MonitoringSection section={section} services={visibleServices.filter((service) => service.category === section.id)} onSelect={(service) => setSelectedServiceId(service.id)} key={section.id} />
            )) : <EmptyState onReset={() => setFilters(DEFAULT_FILTERS)} />}
          </div>
        </>
      ) : !loading && !error ? <EmptyState onReset={() => setFilters(DEFAULT_FILTERS)} /> : null}
      <ServiceDrawer service={selectedService} serviceMap={serviceMap} onClose={closeDrawer} onManualCheck={handleManualCheck} isChecking={checkingServiceId === selectedServiceId} canRunManualCheck={canRunManualCheck} manualCheckError={manualCheckError} />
    </section>
  );
};

export default SystemHealth;
