import test from "node:test";
import assert from "node:assert/strict";
import { aggregateTimeline, calculateLatencyMetrics, calculatePlatformHealth } from "./monitoring.aggregation.js";
import { getEffectiveStatus, resolveEffectiveStatuses } from "./monitoring.dependencies.js";

test("timeline aggregation returns fixed chronological ranges and worst bucket status", () => {
  const now = new Date("2026-07-31T16:00:00.000Z");
  const checks = [
    { startedAt: "2026-07-31T15:59:10.000Z", status: "HEALTHY", latencyMs: 100, httpStatus: 200 },
    { startedAt: "2026-07-31T15:59:30.000Z", status: "DOWN", latencyMs: 600, httpStatus: 503 },
  ];
  for (const [range, count] of [["1h", 60], ["24h", 288], ["7d", 336], ["30d", 360]]) {
    const timeline = aggregateTimeline(checks, range, now);
    assert.equal(timeline.length, count);
    assert.ok(new Date(timeline[0].startedAt) < new Date(timeline.at(-1).startedAt));
    assert.equal(timeline.at(-1).status, "DOWN");
  }
});

test("latency metrics include p95 and trend", () => {
  const metrics = calculateLatencyMetrics([100, 120, 140, 600].map((latencyMs) => ({ latencyMs })));
  assert.equal(metrics.maximum, 600);
  assert.equal(metrics.p95, 600);
  assert.equal(metrics.trend, "up");
});

test("dependency-effective status distinguishes direct and inherited failures", () => {
  assert.equal(getEffectiveStatus("HEALTHY", ["DOWN"]), "DEGRADED");
  assert.equal(getEffectiveStatus("DOWN", ["HEALTHY"]), "DOWN");
  const result = resolveEffectiveStatuses([{ key: "api", status: "HEALTHY", dependencies: ["db"] }, { key: "db", status: "DOWN", dependencies: [] }]);
  assert.equal(result[0].effectiveStatus, "DEGRADED");
  assert.equal(result[1].effectiveStatus, "DOWN");
});

test("health score suppresses low-coverage results", () => {
  const services = [{ category: "API", effectiveStatus: "HEALTHY", critical: true }, ...Array.from({ length: 4 }, () => ({ category: "EXTERNAL", effectiveStatus: "UNKNOWN" }))];
  assert.equal(calculatePlatformHealth(services).score, null);
});

test("health score applies category weights once regardless of service count", () => {
  const services = [
    { category: "BUSINESS", effectiveStatus: "HEALTHY", critical: false },
    { category: "API", effectiveStatus: "DOWN", critical: false },
    { category: "API", effectiveStatus: "DOWN", critical: false },
  ];
  assert.equal(calculatePlatformHealth(services).score, 58);
});
