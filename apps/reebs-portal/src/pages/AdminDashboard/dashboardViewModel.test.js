import test from "node:test";
import assert from "node:assert/strict";
import {
  appendHealthSample,
  formatGhs,
  getHealthUptime,
  normalizeHealthStatus,
} from "./dashboardViewModel.js";

test("dashboard money is presented in Ghana cedis from pesewas", () => {
  assert.match(formatGhs(12345), /123\.45/);
  assert.match(formatGhs(12345), /GH₵|GHS/);
});

test("health labels never rely on raw provider status", () => {
  assert.equal(normalizeHealthStatus("ready"), "operational");
  assert.equal(normalizeHealthStatus("unavailable"), "down");
  assert.equal(normalizeHealthStatus("unknown"), "degraded");
});

test("health history is bounded and calculates observed session uptime", () => {
  let samples = [];
  samples = appendHealthSample(samples, "ready", 2);
  samples = appendHealthSample(samples, "degraded", 2);
  samples = appendHealthSample(samples, "ready", 2);
  assert.deepEqual(samples, ["degraded", "operational"]);
  assert.equal(getHealthUptime(samples), 50);
});
