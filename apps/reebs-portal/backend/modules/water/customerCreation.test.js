import assert from "node:assert/strict";
import test from "node:test";
import { createWaterCustomer } from "./customerCreation.js";

function fixture(existing = null) {
  const calls = [];
  const client = { async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("SELECT id, name, phone")) return { rows: existing ? [existing] : [] };
    if (sql.includes("WITH next_customer")) return { rows: [{ id: 51 }] };
    if (sql.includes('FROM "customer" c')) return { rows: [{
      id: 51, name: "Test Customer", phone: "+233 24 000 0000", internalNotes: "Private",
    }] };
    throw new Error("Unexpected query");
  } };
  return { client, calls };
}

test("Water creates a validated identity in the authorized tenant and returns only picker fields", async () => {
  const { client, calls } = fixture();
  const result = await createWaterCustomer(client, 7, {
    name: " Test   Customer ", phone: "0240000000", organizationId: 99, internalNotes: "Not allowed",
  });
  assert.deepEqual(result, { created: true, customer: { id: 51, name: "Test Customer", phone: "+233 24 000 0000" } });
  assert.deepEqual(calls[0].values, ["water-customer-create:7"]);
  assert.deepEqual(calls[1].values, [7, "Test Customer", "+233240000000"]);
  assert.match(calls[1].sql, /"organizationId" = \$1/);
  const insert = calls.find(({ sql }) => sql.includes("WITH next_customer"));
  assert.equal(insert.values[0], 7);
  assert.equal(insert.values[8], "+233240000000");
  assert.equal(insert.values[17], null);
  assert.ok(calls.every(({ sql }) => !/waterSale|paymentRecord|"order"|UPDATE/.test(sql)));
});

test("repeated Water creation selects the existing identity without changing any details", async () => {
  const existing = { id: 22, name: "Existing", phone: "0240000000", deletedAt: null };
  const { client, calls } = fixture(existing);
  const result = await createWaterCustomer(client, 7, { name: "Existing", phone: "0240000000" });
  assert.deepEqual(result, { created: false, customer: { id: 22, name: "Existing", phone: "0240000000" } });
  assert.equal(calls.length, 2);
});

test("Water creation rejects archived duplicates without restoring or editing them", async () => {
  const { client, calls } = fixture({ id: 22, deletedAt: "2026-09-01" });
  await assert.rejects(createWaterCustomer(client, 7, { name: "Archived" }), { statusCode: 409 });
  assert.equal(calls.length, 2);
});

test("Water customer validation fails before any database query", async () => {
  for (const payload of [{ name: " " }, { name: "Test", phone: "123" }]) {
    const { client, calls } = fixture();
    await assert.rejects(createWaterCustomer(client, 7, payload), { statusCode: 400 });
    assert.equal(calls.length, 0);
  }
});
