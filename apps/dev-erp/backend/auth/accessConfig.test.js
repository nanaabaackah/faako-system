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
