import assert from "node:assert/strict";
import test from "node:test";
import { initializePayment } from "./paymentService.js";
import { validateProviderTransaction } from "./paymentApplicationService.js";

const createInitializationClient = () => {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("set_config('app.current_organization_id'")) return { rows: [], rowCount: 1 };
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [], rowCount: 0 };
      if (sql.includes('FROM "order" o')) return { rows: [{
        id: 8,
        reference: "ORD-8",
        customerId: 2,
        customerName: "Ama",
        customerEmail: "ama@example.com",
        currency: "GHS",
        businessUnit: "REEBS_CORE",
        grandTotalCents: 10000,
        amountPaidCents: 2000,
        status: "confirmed",
      }], rowCount: 1 };
      if (sql.includes('UPDATE "paymentAttempt"') && sql.includes("ATTEMPT_EXPIRED")) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM "paymentAttempt"') && sql.includes("status = 'PENDING'") && !sql.includes('"idempotencyKey"')) return { rows: [], rowCount: 0 };
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
      if (sql.includes('FROM "paymentAttempt"') && sql.includes('"idempotencyKey"')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO "paymentAttempt"')) return { rows: [{
        id: 3,
        organizationId: 1,
        customerId: 2,
        reference: "REEBS-PAY-TEST",
        businessUnit: "REEBS_CORE",
        payableType: "ORDER",
        payableId: 8,
        amountCents: 8000,
        currency: "GHS",
        method: "Mobile Money",
        provider: "PAYSTACK",
        status: "PENDING",
        verificationStatus: "UNVERIFIED",
      }], rowCount: 1 };
      if (sql.includes('UPDATE "paymentAttempt"') && sql.includes('"authorizationUrl"')) return { rows: [{
        reference: "REEBS-PAY-TEST",
        amountCents: 8000,
        currency: "GHS",
        method: "Mobile Money",
        provider: "PAYSTACK",
        status: "PENDING",
        verificationStatus: "UNVERIFIED",
        authorizationUrl: "https://checkout.example/test",
      }], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
};

test("initialization sends the server-derived balance and currency to the provider", async () => {
  const client = createInitializationClient();
  let providerInput;
  const result = await initializePayment(client, {
    organizationId: 1,
    payableType: "ORDER",
    payableId: 8,
    idempotencyKey: "payment-init-8",
  }, {
    provider: {
      async initializePayment(input) {
        providerInput = input;
        return {
          authorizationUrl: "https://checkout.example/test",
          accessCode: "safe-code",
          providerReference: input.reference,
        };
      },
    },
  });
  assert.equal(providerInput.amountCents, 8000);
  assert.equal(providerInput.currency, "GHS");
  assert.equal(result.attempt.amountCents, 8000);
});

test("client amount and business unit fields are ignored", async () => {
  const client = createInitializationClient();
  let providerInput;
  await initializePayment(client, {
    organizationId: 1,
    payableType: "ORDER",
    payableId: 8,
    amountCents: 1,
    currency: "USD",
    businessUnit: "WATER",
    idempotencyKey: "tamper-proof-8",
  }, {
    provider: { async initializePayment(input) {
      providerInput = input;
      return { authorizationUrl: "https://checkout.example/test", accessCode: "code", providerReference: input.reference };
    } },
  });
  assert.equal(providerInput.amountCents, 8000);
  assert.equal(providerInput.currency, "GHS");
});

test("verification rejects forged success, amount, currency, and reference values", () => {
  const attempt = {
    reference: "REEBS-PAY-TEST",
    providerReference: "REEBS-PAY-TEST",
    amountCents: 8000,
    currency: "GHS",
  };
  assert.throws(
    () => validateProviderTransaction(attempt, { providerReference: "OTHER", status: "success", amountCents: 8000, currency: "GHS" }),
    (error) => error.code === "PAYMENT_REFERENCE_MISMATCH"
  );
  assert.throws(
    () => validateProviderTransaction(attempt, { providerReference: "REEBS-PAY-TEST", status: "success", amountCents: 1, currency: "GHS" }),
    (error) => error.code === "PAYMENT_AMOUNT_MISMATCH"
  );
  assert.throws(
    () => validateProviderTransaction(attempt, { providerReference: "REEBS-PAY-TEST", status: "success", amountCents: 8000, currency: "USD" }),
    (error) => error.code === "PAYMENT_CURRENCY_MISMATCH"
  );
  assert.throws(
    () => validateProviderTransaction(attempt, { providerReference: "REEBS-PAY-TEST", status: "failed", amountCents: 8000, currency: "GHS" }),
    (error) => error.code === "PAYMENT_NOT_SUCCESSFUL"
  );
});

test("initialization replay returns its original attempt before recalculating a changed balance", async () => {
  let payableWasLoaded = false;
  const requestFingerprint = (await import("./paymentPersistence.js")).fingerprintPaymentRequest({
    organizationId: 1,
    payableType: "ORDER",
    payableId: 8,
    purpose: "AUTO",
    provider: "PAYSTACK",
  });
  const client = {
    async query(sql) {
      if (sql.includes("set_config('app.current_organization_id'")) return { rows: [] };
      if (sql.includes('FROM "paymentAttempt"') && sql.includes('"idempotencyKey"')) return { rows: [{
        reference: "REEBS-PAY-O1-ORIGINAL",
        payableType: "ORDER",
        payableId: 8,
        amountCents: 8000,
        currency: "GHS",
        method: "Mobile Money",
        provider: "PAYSTACK",
        status: "PAID",
        verificationStatus: "VERIFIED",
        requestFingerprint,
      }] };
      if (sql.includes('FROM "order"')) payableWasLoaded = true;
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await initializePayment(client, {
    organizationId: 1,
    payableType: "ORDER",
    payableId: 8,
    idempotencyKey: "payment-init-8",
  });
  assert.equal(result.idempotentReplay, true);
  assert.equal(result.attempt.reference, "REEBS-PAY-O1-ORIGINAL");
  assert.equal(payableWasLoaded, false);
});
