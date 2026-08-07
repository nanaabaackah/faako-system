import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptMonitoringService,
  buildHealthTimeline,
  buildMonitoringFilterOptions,
  filterServices,
  getPlatformSummary,
  MONITORING_SECTIONS,
  normalizeHealthStatus,
  TIMELINE_RANGES,
} from "./monitoringConfig.js";

test("monitoring filter options use stable scalar values for section objects", () => {
  const options = buildMonitoringFilterOptions(MONITORING_SECTIONS, "All categories");
  assert.deepEqual(options.slice(0, 3), [
    { value: "all", label: "All categories" },
    { value: "business-services", label: "Business services" },
    { value: "api-health", label: "API health" },
  ]);
  assert.equal(options.every((option) => ["string", "number"].includes(typeof option.value)), true);
  assert.equal(new Set(options.map((option) => String(option.value))).size, options.length);
});

test("Phase 2 ranges map to server aggregation ranges without staging", () => {
  assert.deepEqual(TIMELINE_RANGES.map((range) => range.apiValue), ["1h", "24h", "7d", "30d"]);
  assert.equal(TIMELINE_RANGES.some((range) => range.value === "staging"), false);
  assert.equal(MONITORING_SECTIONS.length, 6);
});

test("API services adapt to the Phase 1 presentation model", () => {
  const service = adaptMonitoringService({
    id: 7,
    key: "dev-erp-api",
    name: "Dev ERP API",
    category: "API",
    environment: "development",
    provider: "Railway",
    status: "HEALTHY",
    effectiveStatus: "DEGRADED",
    latencyMetrics: { current: 210, minimum: 100, maximum: 510, average: 180, p95: 480, trend: "up" },
    uptimePercentage: 99.9,
    dependencies: ["dev-erp-postgresql"],
    incidents: [],
    timeline: Array.from({ length: 288 }, (_, index) => ({ startedAt: new Date(index * 300000).toISOString(), status: index === 287 ? "DOWN" : "HEALTHY", latencyMs: 100, httpStatus: 200 })),
  }, "day");
  assert.equal(service.category, "api-health");
  assert.equal(service.directStatus, "healthy");
  assert.equal(service.status, "degraded");
  assert.equal(service.timeline.at(-1).status, "down");
  assert.ok(service.timeline.length <= 36);
});

test("filters and summary preserve real status and coverage", () => {
  const services = [
    { name: "API", provider: "Railway", category: "api-health", environment: "production", status: "healthy", latencyMs: 100, incidents: [] },
    { name: "Worker", provider: "Dev ERP", category: "background-workers", environment: "development", status: "unknown", latencyMs: null, incidents: [] },
  ];
  assert.equal(filterServices(services, { search: "api", environment: "all", status: "healthy", category: "all", provider: "all" }).length, 1);
  assert.equal(normalizeHealthStatus("DOWN"), "down");
  assert.deepEqual(getPlatformSummary(services, { score: null, label: "Insufficient coverage", coveragePercentage: 50 }).score, null);
});

test("platform summary excludes intentionally disabled services", () => {
  const services = [
    { name: "API", status: "healthy", enabled: true, latencyMs: 100, incidents: [] },
    { name: "Unused provider", status: "unknown", enabled: false, latencyMs: null, incidents: [] },
  ];
  const summary = getPlatformSummary(services, { score: 100, label: "Healthy", coveragePercentage: 100, monitoringEnabled: true });
  assert.equal(summary.total, 1);
  assert.equal(summary.healthy, 1);
  assert.equal(summary.unknown, 0);
  assert.equal(summary.monitoringEnabled, true);
});

test("dashboard fallback timeline remains range aware", () => {
  const timeline = buildHealthTimeline({ id: "api", status: "offline", latencyMs: 400, range: "hour" });
  assert.equal(timeline.length, 30);
  assert.equal(timeline.at(-1).status, "down");
});
