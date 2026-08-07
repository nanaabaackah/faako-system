import {
  CATEGORY_WEIGHTS,
  HEALTH_SCORE_VALUES,
  STATUS_PRIORITY,
  TIMELINE_RANGES,
} from "./monitoring.constants.js";

const percentile = (values, value) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * value) - 1, sorted.length - 1)];
};

export const aggregateTimeline = (checks = [], range = "24h", now = new Date()) => {
  const definition = TIMELINE_RANGES[range] || TIMELINE_RANGES["24h"];
  const endMs = now.getTime();
  const startMs = endMs - definition.durationMs;
  const buckets = Array.from({ length: definition.buckets }, (_, index) => ({
    index,
    startedAt: new Date(startMs + index * definition.bucketMs).toISOString(),
    completedAt: new Date(startMs + (index + 1) * definition.bucketMs).toISOString(),
    status: "UNKNOWN",
    latencyMs: null,
    httpStatus: null,
    incidentId: null,
    sampleCount: 0,
  }));

  const grouped = new Map();
  checks.forEach((check) => {
    const time = new Date(check.startedAt).getTime();
    const index = Math.floor((time - startMs) / definition.bucketMs);
    if (index < 0 || index >= buckets.length) return;
    const list = grouped.get(index) || [];
    list.push(check);
    grouped.set(index, list);
  });

  grouped.forEach((items, index) => {
    const latencies = items.map((item) => item.latencyMs).filter(Number.isFinite);
    const worst = items.reduce((result, item) => (
      STATUS_PRIORITY[item.status] > STATUS_PRIORITY[result.status] ? item : result
    ), items[0]);
    buckets[index] = {
      ...buckets[index],
      status: worst.status,
      latencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      httpStatus: worst.httpStatus ?? null,
      incidentId: worst.incidentId ?? null,
      sampleCount: items.length,
    };
  });
  return buckets;
};

export const calculateLatencyMetrics = (checks = []) => {
  const values = checks.map((check) => check.latencyMs).filter(Number.isFinite);
  const current = values.at(-1) ?? null;
  const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const midpoint = Math.floor(values.length / 2);
  const olderAverage = midpoint ? values.slice(0, midpoint).reduce((sum, value) => sum + value, 0) / midpoint : null;
  const recentValues = midpoint ? values.slice(midpoint) : values;
  const recentAverage = recentValues.length ? recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length : null;
  const trend = olderAverage === null || recentAverage === null ? "stable" : recentAverage > olderAverage * 1.1 ? "up" : recentAverage < olderAverage * 0.9 ? "down" : "stable";
  return {
    current,
    minimum: values.length ? Math.min(...values) : null,
    maximum: values.length ? Math.max(...values) : null,
    average,
    p95: percentile(values, 0.95),
    trend,
  };
};

export const calculateUptimePercentage = (checks = []) => {
  const configured = checks.filter((check) => check.status !== "UNKNOWN");
  if (!configured.length) return null;
  const available = configured.filter((check) => check.status === "HEALTHY" || check.status === "DEGRADED").length;
  return Math.round((available / configured.length) * 10000) / 100;
};

export const calculatePlatformHealth = (services = []) => {
  const monitoredServices = services.filter((service) => service.enabled !== false);
  const known = monitoredServices.filter((service) => service.effectiveStatus !== "UNKNOWN");
  const categories = Object.keys(CATEGORY_WEIGHTS).map((category) => {
    const categoryServices = known.filter((service) => service.category === category);
    const serviceWeight = categoryServices.reduce((sum, service) => sum + (service.critical ? 1.5 : 1), 0);
    const score = serviceWeight ? categoryServices.reduce((sum, service) => (
      sum + (HEALTH_SCORE_VALUES[service.effectiveStatus] ?? 0) * (service.critical ? 1.5 : 1)
    ), 0) / serviceWeight : null;
    return { category, score };
  }).filter(({ score }) => score !== null);
  const totalWeight = categories.reduce((sum, { category }) => sum + CATEGORY_WEIGHTS[category], 0);
  const weightedScore = categories.reduce((sum, { category, score }) => sum + score * CATEGORY_WEIGHTS[category], 0);
  const coveragePercentage = monitoredServices.length ? Math.round((known.length / monitoredServices.length) * 100) : 0;
  const score = totalWeight ? Math.round(weightedScore / totalWeight) : null;
  return {
    score: coveragePercentage < 50 ? null : score,
    label: coveragePercentage < 50 ? "Insufficient coverage" : score >= 90 ? "Healthy" : score >= 60 ? "Degraded" : "Critical",
    coveragePercentage,
    knownServices: known.length,
    totalServices: monitoredServices.length,
  };
};
