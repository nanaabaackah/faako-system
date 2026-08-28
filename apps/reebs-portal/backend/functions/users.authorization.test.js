import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssignUserRole,
  canAccessUsersMethod,
  isValidUserPassword,
  requiredUsersPermission,
} from "./users.js";

test("only the system administrator may assign privileged or Water roles", () => {
  const admin = { role: "admin", email: "admin@example.com" };
  const systemAdmin = { role: "admin", email: "system_admin@reebs.com" };
  assert.equal(canAssignUserRole(admin, "staff"), true);
  assert.equal(canAssignUserRole(admin, "manager"), false);
  assert.equal(canAssignUserRole(admin, "water"), false);
  assert.equal(canAssignUserRole(admin, "admin"), false);
  assert.equal(canAssignUserRole(systemAdmin, "water"), true);
  assert.equal(canAssignUserRole(systemAdmin, "owner"), true);
});

test("users endpoint maps reads and mutations to stable permission identifiers", () => {
  assert.equal(requiredUsersPermission("GET"), "users:read");
  assert.equal(requiredUsersPermission("POST"), "users:write");
  assert.equal(requiredUsersPermission("PUT"), "users:write");
});

test("users endpoint preserves driver read compatibility but denies driver mutations", () => {
  const driver = { role: "driver", email: "driver@example.com" };
  assert.equal(canAccessUsersMethod(driver, "GET"), true);
  assert.equal(canAccessUsersMethod(driver, "POST"), false);
  assert.equal(canAccessUsersMethod(driver, "PUT"), false);
});

test("users endpoint limits directory reads to established read roles", () => {
  assert.equal(canAccessUsersMethod({ role: "owner" }, "GET"), true);
  assert.equal(canAccessUsersMethod({ role: "manager" }, "GET"), true);
  assert.equal(canAccessUsersMethod({ role: "staff" }, "GET"), false);
  assert.equal(canAccessUsersMethod({ role: "warehouse" }, "GET"), false);
  assert.equal(canAccessUsersMethod({ role: "water" }, "GET"), false);
});

test("users endpoint permits established owner/admin writes and denies lower roles", () => {
  assert.equal(canAccessUsersMethod({ role: "owner" }, "POST"), true);
  assert.equal(canAccessUsersMethod({ role: "admin" }, "POST"), true);
  assert.equal(canAccessUsersMethod({ role: "manager" }, "POST"), false);
  assert.equal(canAccessUsersMethod({ role: "staff" }, "POST"), false);
  assert.equal(canAccessUsersMethod({ role: "warehouse" }, "POST"), false);
  assert.equal(canAccessUsersMethod({ role: "water" }, "POST"), false);
});

test("new and changed user passwords require at least eight characters", () => {
  assert.equal(isValidUserPassword("short"), false);
  assert.equal(isValidUserPassword(" 1234567 "), false);
  assert.equal(isValidUserPassword("correct-horse"), true);
});
