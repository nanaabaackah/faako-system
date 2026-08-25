import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessCommercialConfigMethod,
  listCommercialRules,
  listWaterPrices,
  readableCommercialBusinessUnits,
  validateWaterProductLink,
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

test("only owners and admins may create commercial configuration records", () => {
  assert.equal(canAccessCommercialConfigMethod({ role: "owner" }, "POST", "commercial_rule"), true);
  assert.equal(canAccessCommercialConfigMethod({ role: "admin" }, "POST", "water_price"), true);
  for (const role of ["manager", "staff", "warehouse", "driver", "water"]) {
    assert.equal(canAccessCommercialConfigMethod({ role }, "POST", "commercial_rule"), false);
    assert.equal(canAccessCommercialConfigMethod({ role }, "POST", "water_price"), false);
  }
});

test("Water and Core operational roles read only their applicable commercial domain", () => {
  assert.deepEqual(readableCommercialBusinessUnits({ role: "water" }), ["WATER"]);
  assert.deepEqual(readableCommercialBusinessUnits({ role: "manager" }), ["REEBS_CORE", "SHARED"]);
  assert.deepEqual(readableCommercialBusinessUnits({ role: "owner" }), [
    "REEBS_CORE",
    "WATER",
    "SHARED",
  ]);
});

test("history reads bind only SQL parameters referenced by the query", async () => {
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
  await listWaterPrices(client, 7, {
    includeWater: true,
    view: "history",
    asOf,
  });

  assert.deepEqual(calls[0].params, [7, ["REEBS_CORE"]]);
  assert.doesNotMatch(calls[0].sql, /\$3/);
  assert.deepEqual(calls[1].params, [7]);
  assert.doesNotMatch(calls[1].sql, /\$2/);
});

test("current reads bind as-of before optional filters", async () => {
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
  await listWaterPrices(client, 7, {
    includeWater: true,
    productKey: "gwater-15pk",
    priceType: "RETAIL",
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
  assert.deepEqual(calls[1].params, [
    7,
    asOf.toISOString(),
    "gwater-15pk",
    "RETAIL",
  ]);
  assert.match(calls[1].sql, /"priceType" = \$4/);
});

test("Water prices may remain unlinked from an inventory product", async () => {
  let queried = false;
  const client = {
    async query() {
      queried = true;
      throw new Error("Optional Water product links must not query inventory.");
    },
  };

  assert.equal(await validateWaterProductLink(client, 7, null), null);
  assert.equal(queried, false);
});

test("Water product links require a same-organization WATER product", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [{ id: 41, name: "15pk Gwater", sourceCategoryCode: " water " }],
      };
    },
  };

  const product = await validateWaterProductLink(client, 7, 41);

  assert.equal(product.id, 41);
  assert.deepEqual(calls[0].params, [41, 7]);
  assert.match(calls[0].sql, /"sourceCategoryCode"/);
  assert.match(calls[0].sql, /"organizationId" = \$2/);
});

test("Water product links reject a Core product", async () => {
  const client = {
    async query() {
      return {
        rowCount: 1,
        rows: [{ id: 42, name: "Event chair", sourceCategoryCode: "RENTAL" }],
      };
    },
  };

  await assert.rejects(
    validateWaterProductLink(client, 7, 42),
    (error) => error.statusCode === 400
      && error.code === "WATER_PRODUCT_CLASSIFICATION_REQUIRED"
      && /sourceCategoryCode WATER/.test(error.message)
  );
});

test("Water product links reject products outside the organization", async () => {
  const client = {
    async query() {
      return { rowCount: 0, rows: [] };
    },
  };

  await assert.rejects(
    validateWaterProductLink(client, 7, 99),
    (error) => error.statusCode === 400 && /not found in this organization/.test(error.message)
  );
});
