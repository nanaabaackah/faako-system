import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_BUSINESS_UNITS,
  assertManualPaymentInput,
  deriveOrderPaymentContext,
  getPaymentReference,
  normalizePaymentMethod,
  toPaymentAdminDto,
} from "./paymentDomain.js";

test("normalizes Ghana payment methods without provider-specific method values", () => {
  assert.equal(normalizePaymentMethod("momo"), "Mobile Money");
  assert.equal(normalizePaymentMethod("bank-transfer"), "Bank Transfer");
  assert.equal(normalizePaymentMethod("cash"), "Cash");
  assert.equal(normalizePaymentMethod("card"), "Card");
});

test("derives Core scope and currency from the authoritative order", () => {
  assert.deepEqual(
    deriveOrderPaymentContext({ id: 9, orderNumber: "ORD-9", customerId: 4, currency: "ghs" }),
    {
      businessUnit: PAYMENT_BUSINESS_UNITS.CORE,
      currency: "GHS",
      customerId: 4,
      payableType: "ORDER",
      payableId: 9,
      payableReference: "ORD-9",
    }
  );
});

test("admin DTO has a human reference and identifies manual verification", () => {
  const dto = toPaymentAdminDto({
    id: 12,
    orderId: 9,
    orderNumber: "ORD-9",
    customerId: 4,
    amountCents: 12500,
    method: "momo",
    transactionReference: " momo-123 ",
    confirmationStatus: "manual_recorded",
    currency: "GHS",
  });
  assert.equal(dto.paymentReference, "REEBS-PAY-000012");
  assert.equal(getPaymentReference(dto), "REEBS-PAY-000012");
  assert.equal(dto.source, "MANUAL");
  assert.equal(dto.verificationStatus, "MANUAL_RECORDED");
  assert.equal(dto.businessUnit, "REEBS_CORE");
});

test("manual payments reject invalid amounts", () => {
  assert.throws(
    () => assertManualPaymentInput({ amountCents: 0, method: "cash" }),
    (error) => error.code === "INVALID_PAYMENT_AMOUNT"
  );
});
