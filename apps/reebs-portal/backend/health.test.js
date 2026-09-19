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
  const result = await checkWaterReadiness({
    query: async () => ({ rows: [{ ready: true }] }),
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
});
