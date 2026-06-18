import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_MODULE_KEYS,
  AUTHENTICATED_MODULE_CAPABILITY_ROUTES,
} from "./accessConfig.js";

const resolveModulesForPath = (path) =>
  AUTHENTICATED_MODULE_CAPABILITY_ROUTES.find((entry) => {
    entry.pattern.lastIndex = 0;
    return entry.pattern.test(path);
  })?.modules ?? null;

test("ACCESS_MODULE_KEYS stays aligned with module capability route modules", () => {
  const supportedModules = new Set(ACCESS_MODULE_KEYS);
  const routedModules = AUTHENTICATED_MODULE_CAPABILITY_ROUTES.flatMap((entry) => entry.modules);

  routedModules.forEach((module) => {
    assert.equal(supportedModules.has(module), true, `${module} should be a supported access module`);
  });
});

test("module capability routes cover authenticated productivity surfaces", () => {
  assert.deepEqual(resolveModulesForPath("/api/productivity/entries"), ["dashboard"]);
  assert.deepEqual(resolveModulesForPath("/api/jobs/recommendations"), ["dashboard"]);
  assert.deepEqual(resolveModulesForPath("/api/ai/productivity-coach"), ["dashboard"]);
});

test("Faako onboarding API is protected by the onboarding module", () => {
  assert.deepEqual(resolveModulesForPath("/api/faako-onboarding"), ["faako-onboarding"]);
  assert.deepEqual(resolveModulesForPath("/api/faako-onboarding/request-1"), ["faako-onboarding"]);
});

test("reports summary compatibility route stays owned by audit logs", () => {
  assert.deepEqual(resolveModulesForPath("/api/reports/summary"), ["audit-logs"]);
  assert.deepEqual(resolveModulesForPath("/api/reports/weekly_kpi/send"), ["reports"]);
});
