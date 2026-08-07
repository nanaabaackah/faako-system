const HEALTHY_STATUSES = new Set(["healthy", "online", "ok", "active"]);
const DEGRADED_STATUSES = new Set(["degraded", "warning", "pending"]);
const DOWN_STATUSES = new Set(["down", "offline", "error", "failed", "suspended"]);

export const TIMELINE_RANGES = [
  { value: "hour", apiValue: "1h", label: "Last hour", interval: "1 minute", blocks: 30 },
  { value: "day", apiValue: "24h", label: "Last 24 hours", interval: "5 minutes", blocks: 36 },
  { value: "week", apiValue: "7d", label: "Last 7 days", interval: "30 minutes", blocks: 42 },
  { value: "month", apiValue: "30d", label: "Last 30 days", interval: "2 hours", blocks: 48 },
];

export const MONITORING_SECTIONS = [
  { id: "business-services", apiCategory: "BUSINESS", label: "Business services", description: "Customer-facing and internal workflows" },
  { id: "api-health", apiCategory: "API", label: "API health", description: "Application interfaces and public endpoints" },
  { id: "database-health", apiCategory: "DATABASE", label: "Database health", description: "Primary operational data stores" },
  { id: "infrastructure", apiCategory: "INFRASTRUCTURE", label: "Infrastructure", description: "Hosting, edge, and runtime services" },
  { id: "external-services", apiCategory: "EXTERNAL", label: "External services", description: "Third-party providers and integrations" },
  { id: "background-workers", apiCategory: "WORKER", label: "Background workers", description: "Scheduled and asynchronous jobs" },
];

export const buildMonitoringFilterOptions = (items, label = "All") => [
  { value: "all", label },
  ...items.map((item) => {
    if (item && typeof item === "object") {
      return {
        value: item.value ?? item.id,
        label: item.label ?? String(item.value ?? item.id),
      };
    }
    return { value: item, label: item };
  }),
];

export const normalizeHealthStatus = (status) => {
  const normalized = String(status || "unknown").toLowerCase();
  if (HEALTHY_STATUSES.has(normalized)) return "healthy";
  if (DEGRADED_STATUSES.has(normalized)) return "degraded";
  if (DOWN_STATUSES.has(normalized)) return "down";
  if (normalized === "checking") return "checking";
  return "unknown";
};

const hashString = (value) => Array.from(String(value)).reduce(
  (total, character) => ((total * 31) + character.charCodeAt(0)) % 10007,
  17
);

export const buildHealthTimeline = ({ id, status, latencyMs, range = "day" }) => {
  const rangeDefinition = TIMELINE_RANGES.find((item) => item.value === range) || TIMELINE_RANGES[1];
  const seed = hashString(`${id}-${range}`);
  const currentStatus = normalizeHealthStatus(status);
  const now = Date.now();
  const intervalMinutes = { hour: 1, day: 5, week: 30, month: 120 }[rangeDefinition.value];
  return Array.from({ length: rangeDefinition.blocks }, (_, index) => {
    const distanceFromNow = rangeDefinition.blocks - index - 1;
    const pattern = (seed + index * 19) % 97;
    let blockStatus = pattern < 2 ? "unknown" : "healthy";
    if (currentStatus === "degraded" && (index > rangeDefinition.blocks - 7 || pattern < 12)) blockStatus = "degraded";
    if (currentStatus === "down" && index > rangeDefinition.blocks - 5) blockStatus = "down";
    if (currentStatus === "unknown" && index > rangeDefinition.blocks - 4) blockStatus = "unknown";
    const latencyVariance = ((seed + index * 23) % 61) - 30;
    return {
      id: `${id}-${range}-${index}`,
      status: blockStatus,
      timestamp: new Date(now - distanceFromNow * intervalMinutes * 60 * 1000).toISOString(),
      latencyMs: Number.isFinite(latencyMs) ? Math.max(8, latencyMs + latencyVariance) : null,
      httpStatus: blockStatus === "down" ? 503 : blockStatus === "unknown" ? null : 200,
      duration: `${intervalMinutes} min`,
    };
  });
};

const STATUS_PRIORITY = { unknown: 0, healthy: 1, degraded: 2, down: 3, checking: 0 };

const sampleTimeline = (timeline, targetCount, interval) => {
  if (!Array.isArray(timeline) || !timeline.length) return [];
  const groupSize = Math.max(1, Math.ceil(timeline.length / targetCount));
  const sampled = [];
  for (let index = 0; index < timeline.length; index += groupSize) {
    const group = timeline.slice(index, index + groupSize);
    const worst = group.reduce((result, block) => (
      STATUS_PRIORITY[normalizeHealthStatus(block.status)] > STATUS_PRIORITY[normalizeHealthStatus(result.status)] ? block : result
    ), group[0]);
    const latencies = group.map((block) => block.latencyMs).filter(Number.isFinite);
    sampled.push({
      id: `${worst.startedAt || worst.timestamp}-${index}`,
      status: normalizeHealthStatus(worst.status),
      timestamp: worst.startedAt || worst.timestamp,
      latencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      httpStatus: worst.httpStatus ?? null,
      duration: interval,
      incidentId: worst.incidentId ?? null,
    });
  }
  return sampled.slice(-targetCount);
};

export const adaptMonitoringService = (service, range = "day") => {
  const section = MONITORING_SECTIONS.find((item) => item.apiCategory === service.category);
  const rangeDefinition = TIMELINE_RANGES.find((item) => item.value === range) || TIMELINE_RANGES[1];
  const metrics = service.latencyMetrics || {};
  return {
    ...service,
    category: section?.id || "infrastructure",
    sourceCategory: service.category,
    status: normalizeHealthStatus(service.effectiveStatus || service.status),
    directStatus: normalizeHealthStatus(service.status),
    effectiveStatus: normalizeHealthStatus(service.effectiveStatus || service.status),
    provider: service.provider || "Not configured",
    latencyMs: metrics.current ?? service.latencyMs ?? null,
    averageLatencyMs: metrics.average ?? null,
    minLatencyMs: metrics.minimum ?? null,
    maxLatencyMs: metrics.maximum ?? null,
    p95LatencyMs: metrics.p95 ?? null,
    latencyTrend: metrics.trend || "stable",
    uptimePercentage: Number.isFinite(service.uptimePercentage) ? service.uptimePercentage : null,
    timeline: sampleTimeline(service.timeline, rangeDefinition.blocks, rangeDefinition.interval),
    dependencies: Array.isArray(service.dependencies) ? service.dependencies : [],
    incidents: (Array.isArray(service.incidents) ? service.incidents : []).map((incident) => ({
      ...incident,
      title: incident.summary || `${service.name} incident`,
    })),
    lastSuccessfulCheck: service.lastSuccessfulAt || null,
    lastFailedCheck: service.lastFailedAt || null,
  };
};

export const filterServices = (services, filters) => services.filter((service) => {
  const search = filters.search.trim().toLowerCase();
  if (search && !`${service.name} ${service.provider} ${service.category}`.toLowerCase().includes(search)) return false;
  if (filters.environment !== "all" && service.environment !== filters.environment) return false;
  if (filters.status !== "all" && normalizeHealthStatus(service.status) !== filters.status) return false;
  if (filters.category !== "all" && service.category !== filters.category) return false;
  if (filters.provider !== "all" && service.provider !== filters.provider) return false;
  return true;
});

export const getPlatformSummary = (services, apiSummary = null) => {
  const monitoredServices = services.filter((service) => service.enabled !== false);
  const total = monitoredServices.length;
  const healthy = monitoredServices.filter((service) => normalizeHealthStatus(service.status) === "healthy").length;
  const degraded = monitoredServices.filter((service) => normalizeHealthStatus(service.status) === "degraded").length;
  const down = monitoredServices.filter((service) => normalizeHealthStatus(service.status) === "down").length;
  const unknown = monitoredServices.filter((service) => normalizeHealthStatus(service.status) === "unknown").length;
  const measured = monitoredServices.map((service) => service.latencyMs).filter(Number.isFinite);
  return {
    total,
    healthy,
    degraded,
    down,
    unknown,
    score: Number.isFinite(apiSummary?.score) ? apiSummary.score : null,
    scoreLabel: apiSummary?.label || "Insufficient coverage",
    coveragePercentage: apiSummary?.coveragePercentage ?? 0,
    monitoringEnabled: apiSummary?.monitoringEnabled ?? null,
    averageLatencyMs: measured.length ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length) : null,
    activeIncidents: apiSummary?.activeIncidents ?? services.reduce((sum, service) => sum + service.incidents.filter((incident) => incident.status !== "RESOLVED").length, 0),
  };
};
