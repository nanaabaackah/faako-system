import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessUsersMethod,
  requiredUsersPermission,
} from "./users.js";

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
