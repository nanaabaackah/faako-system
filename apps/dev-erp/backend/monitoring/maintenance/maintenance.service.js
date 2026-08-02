import { sanitizeMonitoringDetails } from "../monitoring.security.js";

export const createMaintenanceService = ({ prisma, isGlobalAdmin, auditWriter }) => {
  const scope = (user) => isGlobalAdmin(user) ? {} : { organizationId: Number(user.organizationId) };
  const audit = (action, window, user) => auditWriter?.({ organizationId: window.organizationId || user?.organizationId, userId: user?.userId, action, targetType: "MaintenanceWindow", targetId: String(window.id), actorLabel: user?.email, source: "api", category: "admin", metadata: sanitizeMonitoringDetails({ startsAt: window.startsAt, endsAt: window.endsAt }) });
  return {
    async list(user) { await this.sweep(); return prisma.maintenanceWindow.findMany({ where: scope(user), include: { service: { select: { id: true, name: true, environment: true } } }, orderBy: { startsAt: "desc" }, take: 200 }); },
    async create(data, user) {
      const organizationId = isGlobalAdmin(user) ? null : Number(user.organizationId);
      const status = data.startsAt <= new Date() && data.endsAt > new Date() ? "ACTIVE" : "SCHEDULED";
      const window = await prisma.maintenanceWindow.create({ data: { ...data, organizationId, status, suppressAlerts: data.suppressAlerts ?? true, createdByUserId: Number(user.userId) || null } });
      await audit("MONITORING_MAINTENANCE_CREATED", window, user); return window;
    },
    async update(id, data, user) { const current = await prisma.maintenanceWindow.findFirst({ where: { id, ...scope(user), status: { in: ["SCHEDULED", "ACTIVE"] } } }); if (!current) throw Object.assign(new Error("Active maintenance window not found."), { status: 404 }); const updated = await prisma.maintenanceWindow.update({ where: { id }, data }); await audit("MONITORING_MAINTENANCE_UPDATED", updated, user); return updated; },
    async cancel(id, user) { const current = await prisma.maintenanceWindow.findFirst({ where: { id, ...scope(user), status: { in: ["SCHEDULED", "ACTIVE"] } } }); if (!current) throw Object.assign(new Error("Active maintenance window not found."), { status: 404 }); const updated = await prisma.maintenanceWindow.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByUserId: Number(user.userId) || null } }); await audit("MONITORING_MAINTENANCE_CANCELLED", updated, user); return updated; },
    getActiveForService(service, organizationId = null, now = new Date()) { return prisma.maintenanceWindow.findFirst({ where: { organizationId, status: { in: ["SCHEDULED", "ACTIVE"] }, suppressAlerts: true, startsAt: { lte: now }, endsAt: { gt: now }, AND: [{ OR: [{ serviceId: service.id }, { serviceId: null }] }, { OR: [{ category: service.category }, { category: null }] }, { OR: [{ environment: service.environment }, { environment: null }] }] }, orderBy: { startsAt: "desc" } }); },
    async sweep(now = new Date()) { const [activated, completed] = await Promise.all([prisma.maintenanceWindow.updateMany({ where: { status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now } }, data: { status: "ACTIVE" } }), prisma.maintenanceWindow.updateMany({ where: { status: { in: ["SCHEDULED", "ACTIVE"] }, endsAt: { lte: now } }, data: { status: "COMPLETED" } })]); return { activated: activated.count, completed: completed.count }; },
  };
};
