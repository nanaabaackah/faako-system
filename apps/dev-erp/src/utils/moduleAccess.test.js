import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessPath,
  getDefaultPathForUser,
  getModuleKeyForPath,
} from "./moduleAccess.js";

const userWithModules = (modules) => ({
  role: {
    permissions: {
      modules,
    },
  },
});

test("unrestricted users can reach any module route", () => {
  assert.equal(canAccessPath({ role: { name: "Admin" } }, "/proposals"), true);
  assert.equal(canAccessPath({ role: { name: "Admin" } }, "/audit-logs"), true);
});

test("rent-only users keep the rent dashboard landing and profile access", () => {
  const rentOnlyUser = userWithModules(["rent"]);

  assert.equal(canAccessPath(rentOnlyUser, "/dashboard"), true);
  assert.equal(canAccessPath(rentOnlyUser, "/rent"), true);
  assert.equal(canAccessPath(rentOnlyUser, "/profile"), true);
  assert.equal(canAccessPath(rentOnlyUser, "/accounting"), false);
  assert.equal(getDefaultPathForUser(rentOnlyUser), "/dashboard");
});

test("custom restricted users can only open their allowed module routes", () => {
  const reportsUser = userWithModules(["reports"]);

  assert.equal(canAccessPath(reportsUser, "/reports"), true);
  assert.equal(canAccessPath(reportsUser, "/dashboard"), false);
  assert.equal(canAccessPath(reportsUser, "/audit-logs"), false);
  assert.equal(getDefaultPathForUser(reportsUser), "/reports");
});

test("mixed rent roles default to rent while rent-only users keep dashboard landing", () => {
  const mixedRentUser = userWithModules(["rent", "reports"]);

  assert.equal(canAccessPath(mixedRentUser, "/dashboard"), false);
  assert.equal(canAccessPath(mixedRentUser, "/rent"), true);
  assert.equal(getDefaultPathForUser(mixedRentUser), "/rent");
});

test("route mapping covers legacy and nested module paths", () => {
  assert.equal(getModuleKeyForPath("/proposals/123/preview"), "proposals");
  assert.equal(getModuleKeyForPath("/faako-onboarding/abc"), "faako-onboarding");
  assert.equal(getModuleKeyForPath("/users"), "user-control");
  assert.equal(getModuleKeyForPath("/system-health"), "system-health");
});
