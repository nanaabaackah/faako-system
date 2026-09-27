import assert from "node:assert/strict";
import test from "node:test";
import { recordManualPayment } from "./paymentService.js";

const fixtureClient = (status = "paid", { hasUniversalRecord = true, hasPriorPayment = true } = {}) => {
  const calls = [];
  const order = { id: 8, organizationId: 1, orderNumber: "ORD-8", customerId: 2,
    currency: "GHS", businessUnit: "REEBS_CORE", grandTotalCents: 8000,
    amountPaidCents: 8000, balanceDueCents: 0, status };
  return { calls, async query(sql, params = []) {
    calls.push({ sql, params });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("set_config") || sql.includes("pg_advisory_xact_lock")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM "order"')) return { rows: [{ ...order }], rowCount: 1 };
    if (sql.includes('FROM "orderPayment"')) {
      assert.deepEqual(params, [1, "manual-replay-test"]);
      if (!hasPriorPayment) return { rows: [], rowCount: 0 };
      return { rows: [{ id: 4, orderId: 8, customerId: 2, amountCents: 8000, method: "Cash",
        idempotencyKey: "manual-replay-test", receiptId: 6, receiptNumber: "REC-6" }], rowCount: 1 };
    }
    if (sql.includes('FROM "paymentApplication"')) {
      assert.deepEqual(params, [4]);
      if (!hasUniversalRecord) return { rows: [], rowCount: 0 };
      return { rows: [{ id: 7, reference: "REEBS-PAY-7", amountCents: 8000, status: "PAID" }], rowCount: 1 };
    }
    assert.fail(`Replay must not mutate payment, stock, receipt or journal records: ${sql}`);
  } };
};

for (const status of ["paid", "completed", "cancelled"]) {
  test(`retrying a successful manual payment on a now-${status} order returns its original receipt`, async () => {
    const client = fixtureClient(status);
    const result = await recordManualPayment(client, {
      organizationId: 1, payableType: "ORDER", payableId: 8,
      amountCents: 8000, method: "cash", idempotencyKey: "manual-replay-test",
    });
    assert.equal(result.idempotentReplay, true);
    assert.equal(result.payment.id, 4);
    assert.equal(result.receipt.id, 6);
    assert.equal(result.universalPayment.payment.reference, "REEBS-PAY-7");
    assert.equal(client.calls.at(-1).sql, "COMMIT");
  });
}

test("a changed manual payment amount cannot reuse a settled request key", async () => {
  const client = fixtureClient();
  await assert.rejects(() => recordManualPayment(client, {
    organizationId: 1, payableType: "ORDER", payableId: 8,
    amountCents: 7000, method: "cash", idempotencyKey: "manual-replay-test",
  }), (error) => error.code === "PAYMENT_IDEMPOTENCY_CONFLICT");
  assert.equal(client.calls.at(-1).sql, "ROLLBACK");
});

test("a legacy manual-payment replay returns its receipt without backfilling financial records", async () => {
  const client = fixtureClient("paid", { hasUniversalRecord: false });
  const result = await recordManualPayment(client, {
    organizationId: 1, payableType: "ORDER", payableId: 8,
    amountCents: 8000, method: "cash", idempotencyKey: "manual-replay-test",
  });
  assert.equal(result.idempotentReplay, true);
  assert.equal(result.receipt.id, 6);
  assert.equal(result.universalPayment.payment, null);
  assert.equal(client.calls.at(-1).sql, "COMMIT");
});

for (const status of ["paid", "completed", "cancelled"]) {
  test(`a new collection on a ${status} order is still rejected without writes`, async () => {
    const client = fixtureClient(status, { hasPriorPayment: false });
    await assert.rejects(() => recordManualPayment(client, {
      organizationId: 1, payableType: "ORDER", payableId: 8,
      amountCents: 8000, method: "cash", idempotencyKey: "manual-replay-test",
    }), (error) => error.statusCode === 409);
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
  });
}
