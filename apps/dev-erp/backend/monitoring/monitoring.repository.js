import { toPersistedRegistryService } from "./monitoring.registry.js";
import { sanitizeCheckResult, sanitizeMonitoringDetails } from "./monitoring.security.js";

export const createMonitoringRepository = ({ prisma }) => ({
  async syncRegistry(services) {
    const persisted = [];
    for (const service of services) {
      persisted.push(await prisma.monitoredService.upsert({
        where: { key: service.key },
        create: toPersistedRegistryService(service),
        update: toPersistedRegistryService(service),
      }));
    }
    const idByKey = new Map(persisted.map((service) => [service.key, service.id]));
    await prisma.serviceDependency.deleteMany({});
    const dependencies = services.flatMap((service) => (service.dependencies || []).map((dependencyKey) => ({
      serviceId: idByKey.get(service.key),
      dependsOnServiceId: idByKey.get(dependencyKey),
    }))).filter((dependency) => dependency.serviceId && dependency.dependsOnServiceId);
    if (dependencies.length) await prisma.serviceDependency.createMany({ data: dependencies, skipDuplicates: true });
    return persisted;
  },

  listServices({ since } = {}) {
    return prisma.monitoredService.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        checks: { where: since ? { startedAt: { gte: since } } : undefined, orderBy: { startedAt: "asc" } },
        incidents: { orderBy: { startedAt: "desc" }, take: 10 },
      },
    });
  },

  findServiceById(id, { since } = {}) {
    return prisma.monitoredService.findUnique({
      where: { id },
      include: {
        checks: { where: since ? { startedAt: { gte: since } } : undefined, orderBy: { startedAt: "asc" } },
        incidents: { orderBy: { startedAt: "desc" }, take: 20 },
      },
    });
  },

  findServiceByKey(key) {
    return prisma.monitoredService.findUnique({ where: { key } });
  },

  async getLatestStatusesByKeys(keys = []) {
    if (!keys.length) return [];
    const services = await prisma.monitoredService.findMany({ where: { key: { in: keys } }, select: { key: true, checks: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true } } } });
    return services.map((service) => ({ key: service.key, status: service.checks[0]?.status || "UNKNOWN" }));
  },

  async recordCheck(serviceId, rawResult) {
    const result = sanitizeCheckResult(rawResult);
    return prisma.healthCheck.create({
      data: {
        serviceId,
        status: result.status,
        latencyMs: result.latencyMs,
        httpStatus: result.httpStatus,
        startedAt: new Date(result.startedAt),
        completedAt: new Date(result.completedAt),
        errorCode: result.errorCode,
        errorSummary: result.errorSummary,
        details: result.details,
      },
    });
  },

  getRecentChecks(serviceId, take = 10) {
    return prisma.healthCheck.findMany({ where: { serviceId }, orderBy: { startedAt: "desc" }, take });
  },

  findActiveIncident(serviceId) {
    return prisma.monitoringIncident.findFirst({
      where: { serviceId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: { startedAt: "desc" },
    });
  },

  createIncident(data) {
    return prisma.monitoringIncident.create({ data: { ...data, metadata: sanitizeMonitoringDetails(data.metadata) } });
  },

  updateIncident(id, data) {
    return prisma.monitoringIncident.update({ where: { id }, data: { ...data, metadata: data.metadata ? sanitizeMonitoringDetails(data.metadata) : undefined } });
  },

  listIncidents({ serviceId = null, status = null, take = 100 } = {}) {
    return prisma.monitoringIncident.findMany({
      where: { ...(serviceId ? { serviceId } : {}), ...(status ? { status } : {}) },
      include: { service: { select: { id: true, key: true, name: true, category: true } } },
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
  },

  listDependencies() {
    return prisma.serviceDependency.findMany({
      include: {
        service: { select: { id: true, key: true, name: true } },
        dependsOnService: { select: { id: true, key: true, name: true } },
      },
      orderBy: { id: "asc" },
    });
  },
});
