import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHealthPayload,
  checkDatabaseReadiness,
  checkWaterReadiness,
} from "./health.js";

test("database readiness uses a lightweight SELECT 1 query", async () => {
  const queries = [];
  const result = await checkDatabaseReadiness({
    query: async (text) => {
      queries.push(text);
      return { rows: [{ "?column?": 1 }] };
    },
  });

  assert.deepEqual(queries, ["SELECT 1"]);
  assert.equal(result.status, "ready");
  assert.equal(result.reachable, true);
});

test("database readiness fails safely without exposing connection errors", async () => {
  const result = await checkDatabaseReadiness({
    query: async () => {
      throw new Error("postgresql://secret-user:secret-password@internal-host/database");
    },
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reachable: false,
    reason: "connection_failed",
  });
});

test("Water readiness reports configuration status without financial values", async () => {
  let sql;
  const result = await checkWaterReadiness({
    query: async (text) => { sql = text; return { rows: [{ ready: true }] }; },
  });
  const payload = buildHealthPayload({
    database: { status: "ready", reachable: true },
    water: result,
    includeWater: true,
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.dependencies.water, "ready");
  assert.equal(JSON.stringify(payload).includes("costPrice"), false);
  assert.equal(JSON.stringify(payload).includes("retailSinglePrice"), false);
  assert.match(sql, /FROM "waterProductPrice"/);
  assert.match(sql, /JOIN configured_prices prices ON prices\."organizationId" = rule\."organizationId"/);
  assert.match(sql, /"effectiveFrom" <= NOW\(\)/);
  assert.match(sql, /HAVING COUNT\(\*\) = 3/);
  assert.match(sql, /HAVING COUNT\(\*\) = 1/);
  assert.equal(sql.includes('"waterProductConfig"'), false);
  assert.equal(sql.includes('"costPrice"'), false);
});

test("Water readiness fails closed when effective commercial configuration is missing", async () => {
  assert.deepEqual(await checkWaterReadiness({ query: async () => ({ rows: [{ ready: false }] }) }), {
    status: "unavailable", ready: false, reason: "commercial_config_missing",
  });
});

test("Water readiness does not expose query errors", async () => {
  assert.deepEqual(await checkWaterReadiness({ query: async () => { throw new Error("private diagnostic fixture"); } }), {
    status: "unavailable", ready: false, reason: "query_failed",
  });
});
