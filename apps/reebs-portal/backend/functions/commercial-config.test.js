import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessCommercialConfigMethod,
  listCommercialRules,
  readableCommercialBusinessUnits,
} from "./commercial-config.js";

test("commercial configuration reads require a scoped view permission", () => {
  assert.equal(canAccessCommercialConfigMethod({}, "GET"), false);
  for (const role of ["owner", "admin", "manager", "water"]) {
    assert.equal(canAccessCommercialConfigMethod({ role }, "GET"), true);
  }
  for (const role of ["staff", "warehouse", "driver"]) {
    assert.equal(canAccessCommercialConfigMethod({ role }, "GET"), false);
  }
});

test("only owners and admins may create commercial rules", () => {
  assert.equal(canAccessCommercialConfigMethod({ role: "owner" }, "POST"), true);
  assert.equal(canAccessCommercialConfigMethod({ role: "admin" }, "POST"), true);
  for (const role of ["manager", "staff", "warehouse", "driver", "water"]) {
    assert.equal(canAccessCommercialConfigMethod({ role }, "POST"), false);
  }
});

test("Water and Core roles can read their applicable commercial rules", () => {
  assert.deepEqual(readableCommercialBusinessUnits({ role: "water" }), ["WATER"]);
  assert.deepEqual(readableCommercialBusinessUnits({ role: "manager" }), ["REEBS_CORE", "SHARED"]);
  assert.deepEqual(readableCommercialBusinessUnits({ role: "owner" }), [
    "REEBS_CORE",
    "WATER",
    "SHARED",
  ]);
});

test("commercial rule history reads are organisation-scoped", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  const asOf = new Date("2026-08-15T12:00:00.000Z");

  await listCommercialRules(client, 7, {
    businessUnits: ["REEBS_CORE"],
    view: "history",
    asOf,
  });

  assert.deepEqual(calls[0].params, [7, ["REEBS_CORE"]]);
  assert.doesNotMatch(calls[0].sql, /\$3/);
});

test("current commercial rule reads bind as-of before optional filters", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  const asOf = new Date("2026-08-15T12:00:00.000Z");

  await listCommercialRules(client, 7, {
    businessUnits: ["REEBS_CORE"],
    businessUnit: "REEBS_CORE",
    key: "service_deposit_bps",
    view: "current",
    asOf,
  });
  assert.deepEqual(calls[0].params, [
    7,
    ["REEBS_CORE"],
    asOf.toISOString(),
    "service_deposit_bps",
  ]);
  assert.match(calls[0].sql, /"key" = \$4/);
});
