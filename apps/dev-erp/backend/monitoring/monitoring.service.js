import { aggregateTimeline, calculateLatencyMetrics, calculatePlatformHealth, calculateUptimePercentage } from "./monitoring.aggregation.js";
import { resolveEffectiveStatuses } from "./monitoring.dependencies.js";
import { applyIncidentRules } from "./monitoring.incidents.js";
import { sanitizeCheckResult, toSafeService } from "./monitoring.security.js";
import { TIMELINE_RANGES } from "./monitoring.constants.js";
import { runDatabaseCheck } from "./checks/database.check.js";
import { runDnsCheck } from "./checks/dns.check.js";
import { runExternalCheck } from "./checks/external.check.js";
import { runHttpCheck } from "./checks/http.check.js";
import { runSslCheck } from "./checks/ssl.check.js";
import { runTcpCheck } from "./checks/tcp.check.js";
import { runWorkerCheck } from "./checks/worker.check.js";

const CHECKERS = { HTTP: runHttpCheck, DATABASE: runDatabaseCheck, DNS: runDnsCheck, SSL: runSslCheck, TCP: runTcpCheck, WORKER: runWorkerCheck, EXTERNAL: runExternalCheck };

const serializeIncident = (incident) => ({
  id: incident.id,
  serviceId: incident.serviceId,
  status: incident.status,
  severity: incident.severity,
  startedAt: incident.startedAt,
  acknowledgedAt: incident.acknowledgedAt,
  resolvedAt: incident.resolvedAt,
  failureCount: incident.failureCount,
  summary: incident.summary,
  service: incident.service,
});

export const createMonitoringService = ({ registry, options, repository, logger, queryFns = {}, fetchImpl = fetch, incidentResponse = null }) => {
  const runtimeByKey = new Map(registry.map((service) => [service.key, service]));

  const runService = async (serviceKey) => {
    const definition = runtimeByKey.get(serviceKey);
    if (!definition || !definition.enabled) return null;
    const persisted = await repository.findServiceByKey(serviceKey);
    if (!persisted) throw Object.assign(new Error("Monitoring service is not registered."), { code: "SERVICE_NOT_REGISTERED" });
    const checker = CHECKERS[definition.checkType];
    logger?.checkStarted(definition);
    let result = sanitizeCheckResult({ status: "UNKNOWN", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), errorCode: "CHECKER_UNAVAILABLE", errorSummary: "The configured checker is unavailable." });
    let attempts = 0;
    if (checker) {
      do {
        result = await checker({
          target: definition.runtimeTarget,
          timeoutMs: definition.timeoutMs,
          method: definition.method || "GET",
          expectedStatusCodes: definition.expectedStatusCodes || [200],
          degradedLatencyMs: options.degradedLatencyMs,
          queryFns,
          fetchImpl,
        });
        attempts += 1;
      } while (result.status === "DOWN" && attempts <= definition.retryCount);
    }
    const check = await repository.recordCheck(persisted.id, result);
    const serviceContext = { ...persisted, critical: definition.critical };
    const maintenance = await incidentResponse?.getMaintenanceSuppression(serviceContext);
    let incident = null;
    if (maintenance?.suppressAlerts) {
      await incidentResponse.recordSuppressedCheck(serviceContext, check, maintenance);
    } else {
      incident = await applyIncidentRules({ repository, service: serviceContext, result: check, options, logger });
      const dependencyStatuses = definition.critical && definition.dependencies?.length ? await repository.getLatestStatusesByKeys(definition.dependencies) : [];
      const dependencyFailed = dependencyStatuses.some(({ status }) => ["DOWN", "DEGRADED"].includes(status));
      const uptimePercentage = incidentResponse?.enabled ? calculateUptimePercentage((await repository.getRecentChecks(persisted.id, 288)).reverse()) : null;
      await incidentResponse?.processCheck({ service: serviceContext, check, incident, dependencyFailed, uptimePercentage });
    }
    logger?.checkCompleted(definition, result, Math.max(attempts - 1, 0));
    return check;
  };

  const buildViews = async (range = "24h") => {
    const definition = TIMELINE_RANGES[range] || TIMELINE_RANGES["24h"];
    const now = new Date();
    const models = await repository.listServices({ since: new Date(now.getTime() - definition.durationMs) });
    const baseViews = models.map((model) => {
      const runtime = runtimeByKey.get(model.key) || {};
      const latest = model.checks.at(-1) || null;
      const status = latest?.status || "UNKNOWN";
      const metrics = calculateLatencyMetrics(model.checks);
      return {
        ...toSafeService(model),
        status,
        latencyMs: metrics.current,
        latencyMetrics: metrics,
        uptimePercentage: calculateUptimePercentage(model.checks),
        lastCheckedAt: latest?.completedAt || null,
        lastSuccessfulAt: [...model.checks].reverse().find((check) => check.status === "HEALTHY")?.completedAt || null,
        lastFailedAt: [...model.checks].reverse().find((check) => check.status === "DOWN")?.completedAt || null,
        dependencies: runtime.dependencies || [],
        timeline: aggregateTimeline(model.checks, range, now),
        incidents: model.incidents.map(serializeIncident),
      };
    });
    return resolveEffectiveStatuses(baseViews);
  };

  return {
    syncRegistry: () => repository.syncRegistry(registry),
    runService,
    async runServiceById(id) {
      const model = await repository.findServiceById(id);
      return model ? runService(model.key) : null;
    },
    async getServices(range) { return buildViews(range); },
    async getSummary(range) {
      const services = await buildViews(range);
      const counts = services.reduce((result, service) => ({ ...result, [service.effectiveStatus]: (result[service.effectiveStatus] || 0) + 1 }), { HEALTHY: 0, DEGRADED: 0, DOWN: 0, UNKNOWN: 0 });
      return { ...calculatePlatformHealth(services), counts, activeIncidents: services.reduce((sum, service) => sum + service.incidents.filter((incident) => !["RESOLVED", "CLOSED"].includes(incident.status)).length, 0), services };
    },
    async getService(id, range) { return (await buildViews(range)).find((service) => service.id === id) || null; },
    async getHistory(id, range) { const service = (await buildViews(range)).find((item) => item.id === id) || null; return service ? { serviceId: id, range, timeline: service.timeline, latencyMetrics: service.latencyMetrics, uptimePercentage: service.uptimePercentage } : null; },
    listIncidents: (filters) => repository.listIncidents(filters).then((items) => items.map(serializeIncident)),
    listDependencies: () => repository.listDependencies(),
  };
};
