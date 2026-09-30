import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoDuplicateManualPaymentReference,
  recordManualOrderPayment,
} from "./manualPaymentService.js";

const clientWithDuplicate = (row) => ({
  async query(sql) {
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  },
});

test("rejects a reused manual bank or Mobile Money reference", async () => {
  await assert.rejects(
    () => assertNoDuplicateManualPaymentReference(clientWithDuplicate({ id: 3, idempotencyKey: "first" }), {
      organizationId: 1,
      method: "Mobile Money",
      transactionReference: "MOMO-123",
      idempotencyKey: "second",
    }),
    (error) => error.code === "DUPLICATE_PAYMENT_REFERENCE" && error.statusCode === 409
  );
});

test("allows the same request key to replay safely", async () => {
  await assert.doesNotReject(() =>
    assertNoDuplicateManualPaymentReference(clientWithDuplicate({ id: 3, idempotencyKey: "same-key" }), {
      organizationId: 1,
      method: "Bank Transfer",
      transactionReference: "BANK-123",
      idempotencyKey: "same-key",
    })
  );
});

test("requires a reference for manually recorded Mobile Money", async () => {
  await assert.rejects(
    () => recordManualOrderPayment({ query: async () => ({ rows: [], rowCount: 0 }) }, {
      organizationId: 1,
      orderId: 10,
      amountCents: 5000,
      method: "Mobile Money",
      transactionReference: "",
    }),
    (error) => error.code === "INVALID_PAYMENT_REFERENCE"
  );
});
