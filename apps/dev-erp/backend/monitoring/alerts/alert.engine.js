import { sanitizeMonitoringDetails, sanitizeText } from "../monitoring.security.js";
import { buildAlertDeduplicationKey, getCooldownBucket, shouldCreateRepeatedEvent } from "./alert.deduplication.js";

const ruleTargetsService = (rule, service) => (
  (!rule.serviceId || rule.serviceId === service.id)
  && (!rule.category || rule.category === service.category)
  && (!rule.environment || rule.environment === service.environment)
);

export const doesAlertRuleMatch = (rule, { service, check, incident = null, uptimePercentage = null, dependencyFailed = false, now = new Date() }) => {
  if (!rule.enabled || !ruleTargetsService(rule, service)) return false;
  switch (rule.triggerType) {
    case "SERVICE_DOWN": return check?.status === "DOWN";
    case "SERVICE_DEGRADED": return check?.status === "DEGRADED";
    case "CONSECUTIVE_FAILURES": return check?.status === "DOWN" && (incident?.failureCount || 0) >= (rule.consecutiveFailures || 2);
    case "LATENCY_THRESHOLD": return Number.isFinite(check?.latencyMs) && check.latencyMs >= (rule.thresholdValue ?? 1000);
    case "UPTIME_BELOW": return Number.isFinite(uptimePercentage) && uptimePercentage < (rule.thresholdValue ?? 99);
    case "SSL_EXPIRY": return service.checkType === "SSL" && Number(check?.details?.daysRemaining) <= (rule.thresholdValue ?? 7);
    case "WORKER_STALE": return service.checkType === "WORKER" && check?.status === "DOWN";
    case "CRITICAL_DEPENDENCY_FAILURE": return Boolean(service.critical && dependencyFailed);
    case "INCIDENT_UNACKNOWLEDGED": return Boolean(incident && incident.status === "OPEN" && now.getTime() - new Date(incident.startedAt).getTime() >= (rule.thresholdValue ?? 15) * 60_000);
    case "INCIDENT_UNRESOLVED": return Boolean(incident && !["RESOLVED", "CLOSED"].includes(incident.status) && now.getTime() - new Date(incident.startedAt).getTime() >= (rule.thresholdValue ?? 120) * 60_000);
    default: return false;
  }
};

export const createAlertEngine = ({ prisma, options, incidentService, maintenanceService, delivery, auditWriter }) => {
  const listRules = (service) => prisma.alertRule.findMany({
    where: { enabled: true, OR: [{ serviceId: service.id }, { serviceId: null }], AND: [{ OR: [{ category: service.category }, { category: null }] }, { OR: [{ environment: service.environment }, { environment: null }] }] },
    include: { channels: { include: { channel: true } }, escalationPolicy: { include: { steps: { orderBy: { position: "asc" } } } } },
  });

  const ensureIncident = async (rule, service, check, current) => {
    if (current && current.organizationId === rule.organizationId) return incidentService.initializeIncident(current, { summary: current.summary });
    const existing = await prisma.monitoringIncident.findFirst({ where: { serviceId: service.id, organizationId: rule.organizationId, status: { in: ["OPEN", "ACKNOWLEDGED"] } }, include: { service: true }, orderBy: { startedAt: "desc" } });
    if (existing) {
      if (existing.recoveryCount) return prisma.monitoringIncident.update({ where: { id: existing.id }, data: { recoveryCount: 0 }, include: { service: true } });
      return existing;
    }
    const incident = await prisma.monitoringIncident.create({ data: { organizationId: rule.organizationId, serviceId: service.id, status: "OPEN", severity: rule.severity, title: `${service.name} ${String(rule.triggerType).toLowerCase().replace(/_/g, " ")}`, startedAt: new Date(check.startedAt || Date.now()), failureCount: check.status === "DOWN" ? 1 : 0, summary: `${service.name} matched alert rule “${rule.name}”.`, metadata: sanitizeMonitoringDetails({ ruleId: rule.id, triggerType: rule.triggerType }) }, include: { service: true } });
    await incidentService.initializeIncident(incident, { summary: incident.summary });
    return incident;
  };

  const createAndDeliver = async ({ rule, service, incident, eventType, summary, channel }) => {
    const latest = await prisma.alertEvent.findFirst({ where: { ruleId: rule.id, serviceId: service.id, incidentId: incident?.id || null, channelId: channel?.id || null, eventType: { in: ["TRIGGERED", "REPEATED"] } }, orderBy: { createdAt: "desc" } });
    const repeated = eventType === "TRIGGERED" && latest;
    if (repeated && !shouldCreateRepeatedEvent({ latestEvent: latest, cooldownMinutes: rule.cooldownMinutes })) {
      await prisma.alertEvent.update({ where: { id: latest.id }, data: { occurrenceCount: { increment: 1 } } });
      return null;
    }
    const resolvedType = repeated ? "REPEATED" : eventType;
    const bucket = ["REPEATED", "SUPPRESSED"].includes(resolvedType) ? getCooldownBucket(new Date(), rule.cooldownMinutes) : null;
    const deduplicationKey = buildAlertDeduplicationKey({ ruleId: rule.id, serviceId: service.id, incidentId: incident?.id, eventType: resolvedType, channelId: channel?.id, bucket });
    let event;
    try {
      event = await prisma.alertEvent.create({ data: { ruleId: rule.id, serviceId: service.id, incidentId: incident?.id, channelId: channel?.id, eventType: resolvedType, deduplicationKey, safeSummary: sanitizeText(summary, 500), metadata: sanitizeMonitoringDetails({ severity: rule.severity }) } });
    } catch (error) {
      if (error?.code === "P2002") return null;
      throw error;
    }
    if (incident && channel) await delivery.deliverEvent(event, channel, { ...incident, service: incident.service || service });
    if (incident) {
      await incidentService.addTimeline(incident.id, resolvedType === "RECOVERED" ? "RECOVERY_DETECTED" : "ALERT_SENT", summary, null, { ruleId: rule.id, channelType: channel?.type });
      await auditWriter?.({ organizationId: incident.organizationId, action: `MONITORING_ALERT_${resolvedType}`, targetType: "MonitoringIncident", targetId: String(incident.id), source: "monitoring", category: "incident", metadata: { ruleId: rule.id, channelType: channel?.type } });
    }
    return event;
  };

  const channelsFor = async (rule) => {
    const configured = rule.channels.map((relation) => relation.channel).filter((channel) => channel.enabled);
    if (configured.length) return configured;
    const fallback = await prisma.monitoringNotificationChannel.findFirst({ where: { organizationId: rule.organizationId, type: "IN_APP", enabled: true } });
    return fallback ? [fallback] : [];
  };

  return {
    enabled: options.enabled,
    async syncDefaults() {
      const channel = await prisma.monitoringNotificationChannel.findFirst({ where: { organizationId: null, type: "IN_APP" } }) || await prisma.monitoringNotificationChannel.create({ data: { name: "Dev ERP in-app", type: "IN_APP", safeDisplay: "Dev ERP in-app notifications" } });
      for (const definition of options.defaultRules) {
        const rule = await prisma.alertRule.findFirst({ where: { organizationId: null, name: definition.name } }) || await prisma.alertRule.create({ data: definition });
        await prisma.alertRuleChannel.upsert({ where: { ruleId_channelId: { ruleId: rule.id, channelId: channel.id } }, create: { ruleId: rule.id, channelId: channel.id }, update: {} });
      }
    },
    async getMaintenanceSuppression(service) { return maintenanceService.getActiveForService(service, null); },
    async recordSuppressedCheck(service, check, window) {
      await prisma.healthCheck.update({ where: { id: check.id }, data: { details: sanitizeMonitoringDetails({ ...(check.details || {}), maintenanceAffected: true, maintenanceWindowId: window.id }) } });
      const activeIncident = await prisma.monitoringIncident.findFirst({ where: { serviceId: service.id, organizationId: window.organizationId, status: { in: ["OPEN", "ACKNOWLEDGED"] } } });
      if (activeIncident) await incidentService.addTimeline(activeIncident.id, "MAINTENANCE_SUPPRESSED", `${service.name} alert suppressed by maintenance window “${window.name}”.`, null, { maintenanceWindowId: window.id });
      const rules = await listRules(service);
      for (const rule of rules.filter((entry) => entry.organizationId === window.organizationId && doesAlertRuleMatch(entry, { service, check }))) {
        const channels = await channelsFor(rule);
        for (const channel of channels.length ? channels : [null]) await createAndDeliver({ rule, service, incident: null, eventType: "SUPPRESSED", summary: `${service.name} alert suppressed by maintenance window “${window.name}”.`, channel });
      }
      return null;
    },
    async processCheck({ service, check, incident = null, uptimePercentage = null, dependencyFailed = false }) {
      if (!options.enabled) return incident;
      const rules = await listRules(service);
      if (check.status === "HEALTHY" && !dependencyFailed) {
        const recoverable = await prisma.monitoringIncident.findMany({ where: { serviceId: service.id, OR: [{ status: { in: ["OPEN", "ACKNOWLEDGED"] } }, { status: "RESOLVED", recoveredAt: null }] }, include: { service: true } });
        for (const recoveredIncident of recoverable) {
          const priorEvents = await prisma.alertEvent.findMany({ where: { incidentId: recoveredIncident.id, eventType: { in: ["TRIGGERED", "REPEATED"] } }, select: { ruleId: true } });
          const triggeredRuleIds = new Set(priorEvents.map((event) => event.ruleId));
          const matchingRules = rules.filter((rule) => rule.organizationId === recoveredIncident.organizationId && rule.recoveryNotifications && triggeredRuleIds.has(rule.id));
          if (!["RESOLVED", "CLOSED"].includes(recoveredIncident.status)) {
            const recoveryCount = recoveredIncident.recoveryCount + 1;
            if (recoveryCount < options.recoveryThreshold) {
              await prisma.monitoringIncident.update({ where: { id: recoveredIncident.id }, data: { recoveryCount } });
              continue;
            }
            await prisma.monitoringIncident.update({ where: { id: recoveredIncident.id }, data: recoveredIncident.autoResolve ? { status: "RESOLVED", recoveryCount, recoveredAt: new Date(check.completedAt), resolvedAt: new Date(check.completedAt) } : { recoveryCount, recoveredAt: new Date(check.completedAt) } });
          }
          else if (recoveredIncident.status === "RESOLVED" && !recoveredIncident.recoveredAt) await prisma.monitoringIncident.update({ where: { id: recoveredIncident.id }, data: { recoveredAt: new Date(check.completedAt) } });
          const recoveryStatus = recoveredIncident.autoResolve ? "RESOLVED" : recoveredIncident.status;
          for (const rule of matchingRules) for (const channel of await channelsFor(rule)) await createAndDeliver({ rule, service, incident: { ...recoveredIncident, status: recoveryStatus, recoveredAt: new Date(check.completedAt) }, eventType: "RECOVERED", summary: `${service.name} recovered after confirmed healthy checks.`, channel });
        }
        return incident;
      }
      for (const rule of rules) {
        if (!doesAlertRuleMatch(rule, { service, check, incident, uptimePercentage, dependencyFailed })) continue;
        const maintenance = await maintenanceService.getActiveForService(service, rule.organizationId);
        if (maintenance?.suppressAlerts) { await this.recordSuppressedCheck(service, check, maintenance); continue; }
        const ruleIncident = await ensureIncident(rule, service, check, incident);
        if (incident && ruleIncident.organizationId === incident.organizationId) incident = ruleIncident;
        for (const channel of await channelsFor(rule)) await createAndDeliver({ rule, service, incident: ruleIncident, eventType: "TRIGGERED", summary: `${service.name} triggered ${rule.name}.`, channel });
      }
      return incident;
    },
    createAndDeliver,
    listRules,
  };
};
