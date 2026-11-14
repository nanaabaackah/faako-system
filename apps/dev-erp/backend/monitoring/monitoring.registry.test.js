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

test("TWE and TTNGH web/API checks are included and unconfigured endpoints stay unknown", () => {
  const { services } = buildMonitoringRegistry({ APP_ENV: "production" });
  for (const key of ["twe-web", "twe-api", "ttngh-web", "ttngh-api"]) {
    const service = services.find((item) => item.key === key);
    assert.ok(service, `missing ${key}`);
    assert.equal(service.runtimeTarget, null);
  }
});

test("TWE and TTNGH configured targets resolve to their public health endpoints", () => {
  const { services } = buildMonitoringRegistry({
    APP_ENV: "production",
    TRAVEL_WITH_EASE_WEB_BASE_URL: "https://www.example-twe.test",
    TRAVEL_WITH_EASE_API_BASE_URL: "https://api.example-twe.test",
    TTNGH_BASE_URL: "https://www.example-ttngh.test",
    TTNGH_API_BASE_URL: "https://api.example-ttngh.test",
  });
  const endpoints = Object.fromEntries(services.map((service) => [service.key, service.runtimeTarget]));
  assert.equal(endpoints["twe-web"], "https://www.example-twe.test/");
  assert.equal(endpoints["twe-api"], "https://api.example-twe.test/healthz");
  assert.equal(endpoints["ttngh-web"], "https://www.example-ttngh.test/");
  assert.equal(endpoints["ttngh-api"], "https://api.example-ttngh.test/healthz");
  assert.equal(validateRegistry(services).length, 0);
});
