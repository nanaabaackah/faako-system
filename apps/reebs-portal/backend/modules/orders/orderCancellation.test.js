import assert from "node:assert/strict";
import test from "node:test";
import { cancelOrder } from "../../functions/_shared/shopOrders.js";

const fixtureClient = (fields = {}) => {
  const calls = [];
  let order = { id: 9, organizationId: 7, orderNumber: "ORD-TEST-9",
    status: "pending_payment", amountPaidCents: 0, paymentStatus: "unpaid", ...fields };
  return { calls, async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes('FROM "order"')) {
      assert.match(sql, /FOR UPDATE/);
      assert.deepEqual(params, [9, 7]);
      return { rows: [order], rowCount: 1 };
    }
    if (sql.includes('FROM "stockMovement"')) return { rows: [], rowCount: 0 };
    if (sql.includes('UPDATE "order"')) {
      order = { ...order, status: params[0], paymentStatus: params[2] };
      return { rows: [order], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO "orderEvent"')) return { rows: [{ id: 1 }], rowCount: 1 };
    assert.fail(`Unexpected cancellation side effect: ${sql}`);
  } };
};
const input = { organizationId: 7, orderId: 9, reason: "Customer request", actor: { userId: 3 } };

for (const paidFields of [{ amountPaidCents: 5000 }, { paymentStatus: "partially_paid" }]) {
  test(`paid cancellation checks the locked row before any effects: ${JSON.stringify(paidFields)}`, async () => {
    const client = fixtureClient(paidFields);
    await assert.rejects(() => cancelOrder(client, input), (error) =>
      error.statusCode === 403 && error.code === "PAID_ORDER_CANCELLATION_FORBIDDEN");
    assert.equal(client.calls.length, 1);
  });
}

test("an authorized admin can cancel a paid open order without pretending to issue a refund", async () => {
  const client = fixtureClient({ status: "paid", amountPaidCents: 5000, paymentStatus: "paid" });
  const result = await cancelOrder(client, { ...input, canCancelPaid: true });
  assert.equal(result.status, "cancelled");
  assert.equal(result.paymentStatus, "refund_pending");
});

for (const status of ["delivered", "completed", "refunded"]) {
  test(`even an admin cannot bypass the ${status} lifecycle through cancellation`, async () => {
    const client = fixtureClient({ status });
    await assert.rejects(() => cancelOrder(client, { ...input, canCancelPaid: true }),
      (error) => error.statusCode === 409 && error.code === "INVALID_ORDER_TRANSITION");
    assert.equal(client.calls.length, 1);
  });
}

test("an unpaid open order remains cancellable", async () => {
  const client = fixtureClient();
  const result = await cancelOrder(client, input);
  assert.equal(result.status, "cancelled");
  assert.equal(result.paymentStatus, "unpaid");
});

test("a repeated cancellation does not restore stock a second time", async () => {
  const client = fixtureClient({ status: "cancelled" });
  const result = await cancelOrder(client, input);
  assert.equal(result.status, "cancelled");
  assert.equal(client.calls.length, 1);
});
