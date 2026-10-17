import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_MODULE_KEYS,
  AUTHENTICATED_MODULE_CAPABILITY_ROUTES,
  MODULE_CAPABILITY_PUBLIC_PATHS,
} from "./accessConfig.js";

const resolveModulesForPath = (path) =>
  AUTHENTICATED_MODULE_CAPABILITY_ROUTES.find((entry) => {
    entry.pattern.lastIndex = 0;
    return entry.pattern.test(path);
  })?.modules ?? null;

const isPublicCapabilityPath = (path) =>
  MODULE_CAPABILITY_PUBLIC_PATHS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(path);
  });

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

test("system health AI diagnostics require system health module access", () => {
  assert.deepEqual(
    resolveModulesForPath("/api/ai/system-health-diagnosis"),
    ["system-health"]
  );
});

test("projects API is protected by the projects module", () => {
  assert.deepEqual(resolveModulesForPath("/api/projects"), ["projects"]);
  assert.deepEqual(resolveModulesForPath("/api/projects/12"), ["projects"]);
  assert.deepEqual(resolveModulesForPath("/api/projects/12/tasks"), ["projects"]);
  assert.deepEqual(resolveModulesForPath("/api/projects/12/tasks/4/status"), ["projects"]);
  assert.deepEqual(resolveModulesForPath("/api/projects/12/task-assignees"), ["projects"]);
});

test("Faako onboarding API is protected by the onboarding module", () => {
  assert.deepEqual(resolveModulesForPath("/api/faako-onboarding"), ["faako-onboarding"]);
  assert.deepEqual(resolveModulesForPath("/api/faako-onboarding/request-1"), ["faako-onboarding"]);
});

test("reports summary compatibility route stays owned by audit logs", () => {
  assert.deepEqual(resolveModulesForPath("/api/reports/summary"), ["audit-logs"]);
  assert.deepEqual(resolveModulesForPath("/api/reports/weekly_kpi/send"), ["reports"]);
});

test("invoice payment ledger and reconciliation routes require invoicing capability", () => {
  assert.deepEqual(resolveModulesForPath("/api/invoices/12/payments"), ["invoicing"]);
  assert.deepEqual(resolveModulesForPath("/api/invoice-payments/reconciliation-report"), ["invoicing"]);
});

test("interactive proposal token routes bypass module capability auth only", () => {
  assert.equal(isPublicCapabilityPath("/api/proposals/interactive/token"), true);
  assert.equal(isPublicCapabilityPath("/api/proposals/12/versions"), false);
  assert.deepEqual(resolveModulesForPath("/api/proposals/12/versions"), ["proposals"]);
});
