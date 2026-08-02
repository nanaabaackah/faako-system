export const MONITORING_STATUSES = Object.freeze({
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  DOWN: "DOWN",
  UNKNOWN: "UNKNOWN",
});

export const MONITORING_CATEGORIES = Object.freeze([
  "BUSINESS",
  "API",
  "DATABASE",
  "INFRASTRUCTURE",
  "EXTERNAL",
  "WORKER",
]);

export const MONITORING_CHECK_TYPES = Object.freeze([
  "HTTP",
  "DATABASE",
  "DNS",
  "SSL",
  "TCP",
  "WORKER",
  "EXTERNAL",
  "SYNTHETIC",
]);

export const STATUS_PRIORITY = Object.freeze({ UNKNOWN: 0, HEALTHY: 1, DEGRADED: 2, DOWN: 3 });

export const TIMELINE_RANGES = Object.freeze({
  "1h": { durationMs: 60 * 60 * 1000, bucketMs: 60 * 1000, buckets: 60 },
  "24h": { durationMs: 24 * 60 * 60 * 1000, bucketMs: 5 * 60 * 1000, buckets: 288 },
  "7d": { durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000, buckets: 336 },
  "30d": { durationMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 2 * 60 * 60 * 1000, buckets: 360 },
});

export const DEFAULT_MONITORING_OPTIONS = Object.freeze({
  enabled: false,
  maxConcurrency: 4,
  defaultTimeoutMs: 8000,
  incidentFailureThreshold: 2,
  incidentRecoveryThreshold: 2,
  retentionDays: 60,
  schedulerTickMs: 15000,
  degradedLatencyMs: 500,
});

export const CATEGORY_WEIGHTS = Object.freeze({
  BUSINESS: 35,
  API: 25,
  DATABASE: 20,
  INFRASTRUCTURE: 10,
  EXTERNAL: 5,
  WORKER: 5,
});

export const HEALTH_SCORE_VALUES = Object.freeze({ HEALTHY: 100, DEGRADED: 60, DOWN: 0 });
