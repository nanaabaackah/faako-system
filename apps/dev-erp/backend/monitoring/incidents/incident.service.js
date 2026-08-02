import { sanitizeMonitoringDetails, sanitizeText } from "../monitoring.security.js";
import { INCIDENT_TRANSITIONS } from "./incident.constants.js";
import { buildIncidentCsv, buildIncidentPdf, toSafeExportIncident } from "./incident.export.js";
import { calculateIncidentTargets } from "./incident.sla.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });
const actor = (user) => ({ actorUserId: Number(user?.userId) || null, actorLabel: sanitizeText(user?.email || user?.fullName || "System", 160) });

const incidentInclude = {
  service: { select: { id: true, key: true, name: true, category: true, environment: true, provider: true } },
  timeline: { orderBy: { createdAt: "asc" } },
  alertEvents: { orderBy: { createdAt: "asc" }, select: { id: true, eventType: true, deliveryStatus: true, safeSummary: true, createdAt: true, deliveredAt: true } },
};

const safeIncident = (incident, assignee = null) => ({
  id: incident.id,
  organizationId: incident.organizationId,
  serviceId: incident.serviceId,
  service: incident.service,
  title: incident.title || incident.summary || `${incident.service?.name || "Service"} incident`,
  summary: incident.summary,
  severity: incident.severity,
  status: incident.status,
  startedAt: incident.startedAt,
  acknowledgedAt: incident.acknowledgedAt,
  recoveredAt: incident.recoveredAt,
  resolvedAt: incident.resolvedAt,
  closedAt: incident.closedAt,
  assignedUserId: incident.assignedUserId,
  assignedRoleId: incident.assignedRoleId,
  assignedUser: assignee,
  responseDueAt: incident.responseDueAt,
  resolutionDueAt: incident.resolutionDueAt,
  responseBreachedAt: incident.responseBreachedAt,
  resolutionBreachedAt: incident.resolutionBreachedAt,
  failureCount: incident.failureCount,
  recoveryCount: incident.recoveryCount,
  rootCause: incident.rootCause,
  impactSummary: incident.impactSummary,
  resolutionSummary: incident.resolutionSummary,
  timeline: incident.timeline || [],
  alertEvents: incident.alertEvents || [],
  createdAt: incident.createdAt,
  updatedAt: incident.updatedAt,
});

export const createIncidentService = ({ prisma, isGlobalAdmin, auditWriter }) => {
  const scopeWhere = (user) => isGlobalAdmin(user) ? {} : { organizationId: Number(user?.organizationId) || -1 };

  const loadScoped = async (id, user) => {
    const incident = await prisma.monitoringIncident.findFirst({ where: { id, ...scopeWhere(user) }, include: incidentInclude });
    if (!incident) throw httpError(404, "Incident not found.");
    return incident;
  };

  const addTimeline = (incidentId, type, summary, user = null, details = null) => prisma.incidentTimelineEntry.create({
    data: { incidentId, type, summary: sanitizeText(summary, 500) || "Incident updated.", ...actor(user), details: sanitizeMonitoringDetails(details) },
  });

  const audit = (action, incident, user, metadata = null) => auditWriter?.({
    organizationId: incident.organizationId || user?.organizationId,
    userId: user?.userId,
    action,
    targetType: "MonitoringIncident",
    targetId: String(incident.id),
    actorLabel: user?.email,
    source: "api",
    category: "incident",
    metadata: sanitizeMonitoringDetails(metadata),
  });

  const transition = async ({ incident, to, user, data = {}, timelineType, summary }) => {
    if (!INCIDENT_TRANSITIONS[incident.status]?.has(to)) throw httpError(409, `Incident cannot transition from ${incident.status} to ${to}.`);
    const updated = await prisma.monitoringIncident.update({ where: { id: incident.id }, data: { status: to, ...data } });
    await Promise.all([addTimeline(incident.id, timelineType, summary, user), audit(`MONITORING_INCIDENT_${to}`, incident, user)]);
    return loadScoped(updated.id, user);
  };

  const enrich = async (items) => {
    const ids = [...new Set(items.map((item) => item.assignedUserId).filter(Boolean))];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, fullName: true } }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return items.map((item) => safeIncident(item, byId.get(item.assignedUserId) || null));
  };

  return {
    addTimeline,
    async initializeIncident(incident, { type = "DETECTED", summary = null } = {}) {
      if (incident.responseDueAt && incident.resolutionDueAt) return incident;
      const targets = calculateIncidentTargets(incident);
      const updated = await prisma.monitoringIncident.update({ where: { id: incident.id }, data: { title: incident.title || incident.summary, ...targets } });
      await addTimeline(incident.id, "CREATED", incident.summary || "Monitoring incident created.");
      await addTimeline(incident.id, type, summary || incident.summary || "Monitoring failure detected.");
      return updated;
    },
    async list(filters, user) {
      const where = { ...scopeWhere(user), ...(filters.status ? { status: filters.status } : {}), ...(filters.severity ? { severity: filters.severity } : {}), ...(filters.serviceId ? { serviceId: filters.serviceId } : {}), ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}) };
      const items = await prisma.monitoringIncident.findMany({ where, include: { service: incidentInclude.service }, orderBy: { startedAt: "desc" }, take: filters.take });
      return enrich(items);
    },
    async get(id, user) {
      const incident = await loadScoped(id, user);
      return (await enrich([incident]))[0];
    },
    async acknowledge(id, user) {
      const incident = await loadScoped(id, user);
      return safeIncident(await transition({ incident, to: "ACKNOWLEDGED", user, data: { acknowledgedAt: new Date(), acknowledgedByUserId: Number(user.userId) || null }, timelineType: "ACKNOWLEDGED", summary: "Incident acknowledged." }));
    },
    async assign(id, assignment, user) {
      const incident = await loadScoped(id, user);
      let assignedLabel;
      if (assignment.assignedUserId) {
        const target = await prisma.user.findFirst({ where: { id: assignment.assignedUserId, status: "ACTIVE", ...(!isGlobalAdmin(user) ? { organizationId: Number(user.organizationId) } : {}) }, select: { id: true, fullName: true, organizationId: true } });
        if (!target) throw httpError(400, "The selected assignee is not an active authorized user.");
        assignedLabel = target.fullName;
      } else {
        const role = await prisma.role.findFirst({ where: { id: assignment.assignedRoleId, ...(!isGlobalAdmin(user) ? { organizationId: Number(user.organizationId) } : {}) }, select: { id: true, name: true } });
        if (!role) throw httpError(400, "The selected role is not authorized for this incident.");
        assignedLabel = role.name;
      }
      const updated = await prisma.monitoringIncident.update({ where: { id }, data: { assignedUserId: assignment.assignedUserId, assignedRoleId: assignment.assignedRoleId } });
      await addTimeline(id, "ASSIGNED", `Incident assigned to ${assignedLabel}.`, user, assignment);
      if (assignment.assignedUserId) await prisma.monitoringNotification.create({ data: { organizationId: incident.organizationId, userId: assignment.assignedUserId, incidentId: id, type: "TRIGGERED", title: `Incident #${id} assigned to you`, message: sanitizeText(incident.summary, 300) || "A monitoring incident requires attention.", link: `/system-health?incident=${id}` } });
      await audit("MONITORING_INCIDENT_ASSIGNED", incident, user, assignment);
      return safeIncident(await loadScoped(updated.id, user));
    },
    async addNote(id, note, user) {
      const incident = await loadScoped(id, user);
      await addTimeline(id, "NOTE_ADDED", note, user);
      await audit("MONITORING_INCIDENT_NOTE_ADDED", incident, user);
      return this.get(id, user);
    },
    async update(id, data, user) {
      const incident = await loadScoped(id, user);
      const updateData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined));
      await prisma.monitoringIncident.update({ where: { id }, data: updateData });
      await Promise.all([addTimeline(id, "UPDATED", "Incident details updated.", user, updateData), audit("MONITORING_INCIDENT_UPDATED", incident, user)]);
      return this.get(id, user);
    },
    async resolve(id, resolution, user) {
      const incident = await loadScoped(id, user);
      return safeIncident(await transition({ incident, to: "RESOLVED", user, data: { ...resolution, resolvedAt: new Date() }, timelineType: "RESOLVED", summary: resolution.resolutionSummary }));
    },
    async close(id, user) {
      const incident = await loadScoped(id, user);
      return safeIncident(await transition({ incident, to: "CLOSED", user, data: { closedAt: new Date() }, timelineType: "CLOSED", summary: "Incident closed." }));
    },
    async reopen(id, note, user) {
      const incident = await loadScoped(id, user);
      const targets = calculateIncidentTargets({ severity: incident.severity, startedAt: new Date() });
      return safeIncident(await transition({ incident, to: "OPEN", user, data: { resolvedAt: null, recoveredAt: null, closedAt: null, recoveryCount: 0, ...targets, responseBreachedAt: null, resolutionBreachedAt: null }, timelineType: "REOPENED", summary: note }));
    },
    async timeline(id, user) { return (await loadScoped(id, user)).timeline; },
    async export(id, format, user) {
      const incident = toSafeExportIncident(await loadScoped(id, user));
      await audit("MONITORING_INCIDENT_EXPORTED", incident, user, { format });
      return format === "csv" ? { contentType: "text/csv; charset=utf-8", extension: "csv", body: buildIncidentCsv(incident) } : { contentType: "application/pdf", extension: "pdf", body: buildIncidentPdf(incident) };
    },
  };
};
