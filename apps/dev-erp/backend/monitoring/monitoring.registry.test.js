import test from "node:test";
import assert from "node:assert/strict";
import { buildMonitoringRegistry } from "./monitoring.registry.js";
import { findDependencyCycles } from "./monitoring.dependencies.js";
import { validateRegistry } from "./monitoring.validation.js";

test("registry includes every monitoring category and keeps missing configuration unknown-ready", () => {
  const { services, options } = buildMonitoringRegistry({ APP_ENV: "development" });
  assert.deepEqual([...new Set(services.map((service) => service.category))].sort(), ["API", "BUSINESS", "DATABASE", "EXTERNAL", "INFRASTRUCTURE", "WORKER"]);
  assert.equal(services.find((service) => service.key === "openai").runtimeTarget, null);
  assert.equal(options.enabled, false);
  assert.equal(services.some((service) => service.environment === "staging"), false);
});

test("registry supports disabling a service without UI changes", () => {
  const { services } = buildMonitoringRegistry({ APP_ENV: "production", MONITORING_DISABLED_SERVICES: "openai,redis" });
  assert.equal(services.find((service) => service.key === "openai").enabled, false);
  assert.equal(services.find((service) => service.key === "redis").enabled, false);
});

test("registry validation rejects duplicate keys", () => {
  const service = { key: "service", name: "Service", category: "API", checkType: "HTTP", intervalSeconds: 60, timeoutMs: 1000, retryCount: 0 };
  assert.equal(validateRegistry([service, service])[0].errors.includes("duplicate key"), true);
});

test("dependency traversal identifies circular definitions", () => {
  assert.deepEqual(findDependencyCycles([{ key: "a", dependencies: ["b"] }, { key: "b", dependencies: ["a"] }])[0], ["a", "b", "a"]);
});
