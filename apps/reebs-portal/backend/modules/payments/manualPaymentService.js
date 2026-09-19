import { recordOrderPayment } from "../../functions/_shared/shopOrders.js";
import {
  assertManualPaymentInput,
  cleanPaymentText,
  normalizeExternalReference,
  toPaymentAdminDto,
} from "./paymentDomain.js";

const getReferenceMethodKey = (method) => {
  const normalized = String(method || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["momo", "mobile_money", "mobilemoney"].includes(normalized)) return "mobile_money";
  if (["bank", "bank_transfer", "transfer"].includes(normalized)) return "bank_transfer";
  if (["card", "credit_card", "debit_card"].includes(normalized)) return "card";
  return normalized;
};

export const findDuplicateExternalReference = async (
  client,
  { organizationId, method, transactionReference }
) => {
  const reference = normalizeExternalReference(transactionReference);
  if (!reference) return null;
  const result = await client.query(
    `SELECT id, "orderId", "amountCents", method, "transactionReference", "idempotencyKey"
     FROM "orderPayment"
     WHERE "organizationId" = $1
       AND CASE
         WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
           IN ('momo', 'mobile_money', 'mobilemoney') THEN 'mobile_money'
         WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
           IN ('bank', 'bank_transfer', 'transfer') THEN 'bank_transfer'
         WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
           IN ('card', 'credit_card', 'debit_card') THEN 'card'
         ELSE REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
       END = $2
       AND LOWER(TRIM(COALESCE("transactionReference", ''))) = LOWER(TRIM($3))
     LIMIT 1`,
    [organizationId, getReferenceMethodKey(method), reference]
  );
  return result.rows?.[0] || null;
};

export const assertNoDuplicateManualPaymentReference = async (client, input = {}) => {
  const reference = normalizeExternalReference(input.transactionReference);
  if (!reference) return;
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `manual-payment-reference:${input.organizationId}:${getReferenceMethodKey(input.method)}:${reference.toLowerCase()}`,
  ]);
  const duplicate = await findDuplicateExternalReference(client, {
    organizationId: input.organizationId,
    method: input.method,
    transactionReference: reference,
  });
  if (duplicate && duplicate.idempotencyKey !== input.idempotencyKey) {
    const error = new Error(`Reference ${reference} is already recorded against another payment.`);
    error.statusCode = 409;
    error.code = "DUPLICATE_PAYMENT_REFERENCE";
    throw error;
  }
};

export const recordManualOrderPayment = async (client, input = {}) => {
  const normalized = assertManualPaymentInput(input);
  const transactionReference = normalizeExternalReference(input.transactionReference);
  if (["Mobile Money", "Bank Transfer", "Card"].includes(normalized.method) && !transactionReference) {
    const error = new Error(`A transaction reference is required for ${normalized.method}.`);
    error.statusCode = 400;
    error.code = "INVALID_PAYMENT_REFERENCE";
    throw error;
  }
  await assertNoDuplicateManualPaymentReference(client, {
    organizationId: input.organizationId,
    method: normalized.method,
    transactionReference,
    idempotencyKey: input.idempotencyKey,
  });

  const result = await recordOrderPayment(client, {
    ...input,
    amountCents: normalized.amountCents,
    method: normalized.method,
    provider: cleanPaymentText(input.provider, 120) || null,
    transactionReference,
    phoneNumber: cleanPaymentText(input.phoneNumber, 80) || null,
    notes: cleanPaymentText(input.notes, 500) || null,
    confirmationStatus: "manual_recorded",
    status: "successful",
  });
  return {
    ...result,
    payment: toPaymentAdminDto({
      ...result.payment,
      orderNumber: result.order?.orderNumber,
      currency: result.order?.currency,
      customerName: result.order?.customerName,
    }),
  };
};
