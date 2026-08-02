import { sanitizeText } from "../monitoring.security.js";
import { buildAlertDeduplicationKey } from "./alert.deduplication.js";
import { getIncidentBreaches } from "../incidents/incident.sla.js";

export const createOperationalSweep = ({ prisma, maintenanceService, incidentService, delivery, auditWriter }) => {
  const recordBreach = async (incident, kind, now) => {
    const field = kind === "response" ? "responseBreachedAt" : "resolutionBreachedAt";
    await prisma.monitoringIncident.update({ where: { id: incident.id }, data: { [field]: now } });
    await incidentService.addTimeline(incident.id, "SLA_BREACHED", `${kind === "response" ? "Response" : "Resolution"} target breached.`, null, { targetType: kind });
    await auditWriter?.({ organizationId: incident.organizationId, action: "MONITORING_INCIDENT_TARGET_BREACHED", targetType: "MonitoringIncident", targetId: String(incident.id), source: "monitoring", category: "incident", severity: "warning", metadata: { targetType: kind } });
  };

  const runEscalations = async (incident, now) => {
    const rules = await prisma.alertRule.findMany({ where: { enabled: true, escalationPolicyId: { not: null }, events: { some: { incidentId: incident.id } } }, include: { escalationPolicy: { include: { steps: { orderBy: { position: "asc" } } } } } });
    for (const rule of rules) {
      const policy = rule.escalationPolicy;
      if (!policy?.enabled || (policy.stopOnAcknowledge && incident.status === "ACKNOWLEDGED")) continue;
      for (const step of policy.steps) {
        if ((step.stopOnAcknowledge && incident.status === "ACKNOWLEDGED") || now.getTime() - new Date(incident.startedAt).getTime() < step.delayMinutes * 60_000) continue;
        const deduplicationKey = buildAlertDeduplicationKey({ ruleId: rule.id, serviceId: incident.serviceId, incidentId: incident.id, eventType: "ESCALATED", channelId: step.targetChannelId, bucket: `step-${step.id}` });
        if (await prisma.alertEvent.findUnique({ where: { deduplicationKey } })) continue;
        const event = await prisma.alertEvent.create({ data: { ruleId: rule.id, serviceId: incident.serviceId, incidentId: incident.id, channelId: step.targetChannelId, eventType: "ESCALATED", deduplicationKey, safeSummary: `Escalation step ${step.position} reached for incident #${incident.id}.` } });
        if (step.targetType === "CHANNEL" && step.targetChannelId) {
          const channel = await prisma.monitoringNotificationChannel.findUnique({ where: { id: step.targetChannelId } });
          if (channel) await delivery.deliverEvent(event, channel, incident);
        } else if (step.targetType === "USER" && step.targetUserId) {
          const target = await prisma.user.findFirst({ where: { id: step.targetUserId, status: "ACTIVE", ...(incident.organizationId ? { organizationId: incident.organizationId } : {}) }, select: { id: true } });
          if (target) await prisma.monitoringNotification.create({ data: { organizationId: incident.organizationId, userId: target.id, incidentId: incident.id, type: "ESCALATED", title: `Escalated incident #${incident.id}`, message: sanitizeText(event.safeSummary, 300), link: `/system-health?incident=${incident.id}` } });
        } else if (step.targetType === "ROLE" && step.targetRoleId) {
          const users = await prisma.user.findMany({ where: { roleId: step.targetRoleId, status: "ACTIVE", ...(incident.organizationId ? { organizationId: incident.organizationId } : {}) }, select: { id: true }, take: 100 });
          if (users.length) await prisma.monitoringNotification.createMany({ data: users.map((user) => ({ organizationId: incident.organizationId, userId: user.id, incidentId: incident.id, type: "ESCALATED", title: `Escalated incident #${incident.id}`, message: sanitizeText(event.safeSummary, 300), link: `/system-health?incident=${incident.id}` })) });
        }
        await incidentService.addTimeline(incident.id, "ESCALATED", event.safeSummary, null, { policyId: policy.id, stepId: step.id });
        await auditWriter?.({ organizationId: incident.organizationId, action: "MONITORING_INCIDENT_ESCALATED", targetType: "MonitoringIncident", targetId: String(incident.id), source: "monitoring", category: "incident", metadata: { policyId: policy.id, stepId: step.id } });
      }
    }
  };

  return async (now = new Date()) => {
    await maintenanceService.sweep(now);
    const incidents = await prisma.monitoringIncident.findMany({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, include: { service: true } });
    for (const incident of incidents) {
      if (!incident.responseDueAt || !incident.resolutionDueAt) Object.assign(incident, await incidentService.initializeIncident(incident, { summary: "Existing monitoring incident enrolled in incident response." }));
      const breaches = getIncidentBreaches(incident, now);
      if (breaches.response) await recordBreach(incident, "response", now);
      if (breaches.resolution) await recordBreach(incident, "resolution", now);
      await runEscalations(incident, now);
    }
    const pending = await prisma.alertEvent.findMany({ where: { deliveryStatus: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }], channelId: { not: null }, incidentId: { not: null } }, include: { channel: true, incident: { include: { service: true } } }, take: 50 });
    for (const event of pending) await delivery.deliverEvent(event, event.channel, event.incident);
    return { incidents: incidents.length, retries: pending.length };
  };
};

const STATE_KEY = Symbol.for("faako.dev-erp.monitoring.incident-response");
export const startIncidentResponseScheduler = ({ sweep, intervalMs, logger }) => {
  if (globalThis[STATE_KEY]) return globalThis[STATE_KEY];
  const timer = setInterval(() => void sweep().catch((error) => logger?.failure("monitoring.incident_response.sweep_failed", null, error)), intervalMs);
  timer.unref?.();
  const scheduler = { timer, stop: () => clearInterval(timer) };
  globalThis[STATE_KEY] = scheduler;
  return scheduler;
};
