import { STATUS_PRIORITY } from "./monitoring.constants.js";

export const findDependencyCycles = (services = []) => {
  const graph = new Map(services.map((service) => [service.key, service.dependencies || []]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  const visit = (key, path = []) => {
    if (visiting.has(key)) {
      cycles.push([...path.slice(path.indexOf(key)), key]);
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    (graph.get(key) || []).forEach((dependency) => {
      if (graph.has(dependency)) visit(dependency, [...path, key]);
    });
    visiting.delete(key);
    visited.add(key);
  };

  graph.forEach((_dependencies, key) => visit(key));
  return cycles;
};

export const getEffectiveStatus = (directStatus, dependencyStatuses = []) => {
  if (directStatus === "DOWN") return "DOWN";
  if (directStatus === "UNKNOWN") return "UNKNOWN";
  const worstDependency = dependencyStatuses.reduce(
    (worst, status) => STATUS_PRIORITY[status] > STATUS_PRIORITY[worst] ? status : worst,
    "HEALTHY"
  );
  if (worstDependency === "DOWN" && directStatus === "HEALTHY") return "DEGRADED";
  if (worstDependency === "DEGRADED" && directStatus === "HEALTHY") return "DEGRADED";
  return directStatus;
};

export const resolveEffectiveStatuses = (services = []) => {
  const byKey = new Map(services.map((service) => [service.key, service]));
  const cache = new Map();
  const resolve = (service, path = new Set()) => {
    if (cache.has(service.key)) return cache.get(service.key);
    if (path.has(service.key)) return service.status;
    const nextPath = new Set(path).add(service.key);
    const dependencies = (service.dependencies || []).map((key) => byKey.get(key)).filter(Boolean);
    const effectiveStatus = getEffectiveStatus(
      service.status,
      dependencies.map((dependency) => resolve(dependency, nextPath))
    );
    cache.set(service.key, effectiveStatus);
    return effectiveStatus;
  };
  return services.map((service) => ({ ...service, effectiveStatus: resolve(service) }));
};
