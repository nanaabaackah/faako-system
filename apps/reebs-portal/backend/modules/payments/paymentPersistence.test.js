import assert from "node:assert/strict";
import test from "node:test";
import {
  createInternalPaymentReference,
  createOrReusePaymentAttempt,
  assertNoActivePaymentAttempt,
  fingerprintPaymentRequest,
  parsePaymentReferenceOrganizationId,
  toPaymentAttemptDto,
} from "./paymentPersistence.js";

test("payment request fingerprints are stable and sensitive to trusted relationship changes", () => {
  const first = fingerprintPaymentRequest({ payableId: 1, payableType: "ORDER" });
  assert.equal(first, fingerprintPaymentRequest({ payableId: 1, payableType: "ORDER" }));
  assert.notEqual(first, fingerprintPaymentRequest({ payableId: 2, payableType: "ORDER" }));
});

test("a second live attempt for the same payable is blocked", async () => {
  const client = {
    async query(sql) {
      if (sql.startsWith('UPDATE "paymentAttempt"')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM "paymentAttempt"')) return { rows: [{ reference: "REEBS-PAY-O1-ACTIVE" }], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  await assert.rejects(
    assertNoActivePaymentAttempt(client, { organizationId: 1, payableType: "ORDER", payableId: 9 }),
    (error) => error.code === "PAYMENT_ATTEMPT_IN_PROGRESS"
  );
});

test("attempt idempotency reuses the same request and rejects a changed fingerprint", async () => {
  const existing = { id: 1, requestFingerprint: "same", reference: "REEBS-PAY-1" };
  const client = {
    async query(sql) {
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
      if (sql.includes('FROM "paymentAttempt"')) return { rows: [existing], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const replay = await createOrReusePaymentAttempt(client, {
    organizationId: 1,
    idempotencyKey: "key-12345",
    requestFingerprint: "same",
  });
  assert.equal(replay.created, false);
  await assert.rejects(
    createOrReusePaymentAttempt(client, {
      organizationId: 1,
      idempotencyKey: "key-12345",
      requestFingerprint: "changed",
    }),
    (error) => error.code === "IDEMPOTENCY_CONFLICT"
  );
});

test("Water references are visibly distinct from Core references", () => {
  const water = createInternalPaymentReference("WATER", 7);
  const core = createInternalPaymentReference("REEBS_CORE", 3);
  assert.match(water, /^REEBS-WATER-O7-/);
  assert.match(core, /^REEBS-PAY-O3-/);
  assert.equal(parsePaymentReferenceOrganizationId(water), 7);
  assert.equal(parsePaymentReferenceOrganizationId(core), 3);
  assert.equal(parsePaymentReferenceOrganizationId("REEBS-PAY-legacy"), null);
});

test("attempt DTO excludes fingerprints and failure details", () => {
  const dto = toPaymentAttemptDto({ reference: "REEBS-PAY-1", amountCents: 2000, method: "momo" });
  assert.equal(dto.method, "Mobile Money");
  assert.equal("requestFingerprint" in dto, false);
  assert.equal("failureMessage" in dto, false);
});
