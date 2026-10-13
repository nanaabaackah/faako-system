import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import { fingerprintPaymentRequest } from "../payments/paymentPersistence.js";

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith("/auditLog.js")) return { url: "data:text/javascript,export const writeAuditLog = async () => {};", shortCircuit: true };
  return next(specifier, context);
} });
const { runWaterCommand } = await import("./commands.js");
after(() => hooks.deregister());
const context = { organizationId: 7, productKey: "gwater-15pk", actorId: 9,
  action: "sale", idempotencyKey: "water-command-test-001", payload: { quantity: 2 } };
const fixture = (previous) => {
  const calls = [];
  return { calls, client: { async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('FROM "waterMutation"')) {
      assert.deepEqual(values, [7, context.idempotencyKey]);
      return { rows: previous ? [previous] : [] };
    }
    return { rows: [] };
  } } };
};
const marker = { actorId: 9, productKey: context.productKey,
  requestFingerprint: fingerprintPaymentRequest({ ...context.payload, action: context.action, productKey: context.productKey }) };

test("Water creation requires a durable retry key before any transaction", async () => {
  const { client, calls } = fixture();
  await assert.rejects(() => runWaterCommand(client, { ...context, idempotencyKey: "" }, assert.fail, assert.fail), { code: "IDEMPOTENCY_KEY_REQUIRED" });
  assert.deepEqual(calls, []);
});

test("Water exact retry returns a fresh scoped projection without repeating its mutation", async () => {
  const { client, calls } = fixture(marker);
  const result = await runWaterCommand(client, context, () => assert.fail("Repeated mutation"), async () => ({ statusCode: 200, scope: "water" }));
  assert.equal(result.scope, "water");
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.equal(calls.some(({ sql }) => sql.startsWith("INSERT")), false);
});

for (const patch of [{ actorId: 10 }, { productKey: "sachet-water-30pk" }, { requestFingerprint: "different" }]) {
  test(`Water refuses retry-key reuse across ${Object.keys(patch)[0]}`, async () => {
    const { client, calls } = fixture({ ...marker, ...patch });
    await assert.rejects(() => runWaterCommand(client, context, assert.fail, assert.fail), { code: "IDEMPOTENCY_CONFLICT" });
    assert.equal(calls.at(-1).sql, "ROLLBACK");
  });
}

test("rejected Water operations roll back their marker and never publish a success projection", async () => {
  const { client, calls } = fixture();
  const rejection = { statusCode: 409, body: "insufficient stock" };
  const result = await runWaterCommand(client, context, async () => rejection, () => assert.fail("Projection after rejected operation"));
  assert.equal(result, rejection);
  assert.ok(calls.some(({ sql }) => sql.startsWith('INSERT INTO "waterMutation"')));
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(calls.some(({ sql }) => sql === "COMMIT"), false);
});

test("projection failure also rolls back the Water mutation transaction", async () => {
  const { client, calls } = fixture();
  await assert.rejects(() => runWaterCommand(client, context, async () => ({ statusCode: 200 }), async () => { throw new Error("Projection failed"); }), /Projection failed/);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
});
