import { recordOrderPayment } from "../../functions/_shared/shopOrders.js";
import { normalizePaymentMethod } from "./paymentDomain.js";
import { calculatePayableCharge, loadPayable, PAYABLE_TYPES } from "./payableRepository.js";
import { createPaymentRecordAndApplication } from "./paymentPersistence.js";

const applicationError = (message, code, statusCode) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

export const validateProviderTransaction = (attempt, transaction) => {
  const attemptReference = String(attempt.providerReference || attempt.reference || "");
  if (transaction.providerReference !== attemptReference) {
    throw applicationError("Provider reference does not match this payment attempt.", "PAYMENT_REFERENCE_MISMATCH", 422);
  }
  if (String(transaction.status || "").toLowerCase() !== "success") {
    throw applicationError("The provider has not confirmed this payment as successful.", "PAYMENT_NOT_SUCCESSFUL", 422);
  }
  if (Number(transaction.amountCents) !== Number(attempt.amountCents)) {
    throw applicationError("Provider amount does not match the trusted amount due.", "PAYMENT_AMOUNT_MISMATCH", 422);
  }
  if (String(transaction.currency || "").toUpperCase() !== String(attempt.currency || "").toUpperCase()) {
    throw applicationError("Provider currency does not match the trusted payable currency.", "PAYMENT_CURRENCY_MISMATCH", 422);
  }
};

export const applyPaymentToPayable = async (client, attempt, transaction, actor) => {
  const payable = await loadPayable(client, {
    organizationId: attempt.organizationId,
    payableType: attempt.payableType,
    payableId: attempt.payableId,
    forUpdate: true,
  });
  if (payable.businessUnit !== attempt.businessUnit || payable.customerId !== attempt.customerId) {
    throw applicationError("Payment relationship no longer matches the trusted payable.", "PAYMENT_RELATIONSHIP_MISMATCH", 409);
  }
  if (payable.currency !== attempt.currency) {
    throw applicationError("Payable currency changed before payment verification.", "PAYMENT_CURRENCY_MISMATCH", 409);
  }
  const currentCharge = calculatePayableCharge(payable, "BALANCE");
  if (Number(attempt.amountCents) > currentCharge.balanceDueCents) {
    throw applicationError("Payment exceeds the current trusted balance and requires reconciliation.", "PAYMENT_OVERAPPLICATION", 409);
  }

  let orderPaymentId = null;
  let receipt = null;
  if (attempt.payableType === PAYABLE_TYPES.ORDER) {
    const orderResult = await recordOrderPayment(client, {
      organizationId: attempt.organizationId,
      orderId: attempt.payableId,
      amountCents: attempt.amountCents,
      method: normalizePaymentMethod(transaction.channel || attempt.method),
      provider: attempt.provider,
      transactionReference: transaction.providerReference,
      phoneNumber: null,
      confirmationStatus: "provider_verified",
      status: "successful",
      idempotencyKey: `provider:${attempt.provider}:${transaction.providerReference}`,
      actor: actor || { userId: null, userName: "Paystack webhook", userEmail: null },
    });
    orderPaymentId = orderResult.payment.id;
    receipt = orderResult.receipt;
  }

  const paidAt = transaction.paidAt && !Number.isNaN(Date.parse(transaction.paidAt))
    ? new Date(transaction.paidAt).toISOString()
    : new Date().toISOString();
  const recorded = await createPaymentRecordAndApplication(client, {
    organizationId: attempt.organizationId,
    customerId: attempt.customerId,
    attemptId: attempt.id,
    reference: attempt.reference,
    businessUnit: attempt.businessUnit,
    amountCents: attempt.amountCents,
    currency: attempt.currency,
    method: normalizePaymentMethod(transaction.channel || attempt.method),
    provider: attempt.provider,
    providerReference: transaction.providerReference,
    source: "ONLINE_PROVIDER",
    verificationStatus: "VERIFIED",
    paidAt,
    recordedByUserId: actor?.userId || null,
    notes: null,
    idempotencyKey: `provider:${attempt.provider}:${transaction.providerReference}`,
    payableType: attempt.payableType,
    payableId: attempt.payableId,
    orderPaymentId,
  });

  if (attempt.payableType === PAYABLE_TYPES.INVOICE) {
    const projectedPaid = payable.amountPaidCents + Number(attempt.amountCents);
    await client.query(
      `UPDATE "invoiceDocument"
       SET "paymentStatus" = $3, "updatedAt" = NOW()
       WHERE "organizationId" = $1 AND id = $2`,
      [
        attempt.organizationId,
        attempt.payableId,
        projectedPaid >= payable.totalCents ? "paid" : projectedPaid > 0 ? "partially_paid" : "unpaid",
      ]
    );
  }
  if (attempt.payableType === PAYABLE_TYPES.WATER_ORDER) {
    await client.query(
      `UPDATE "waterSale"
       SET "paymentStatus" = 'paid', "paymentMethod" = $3, "paymentReference" = $4,
           "providerReference" = $5, "paidAt" = $6
       WHERE "organizationId" = $1 AND id = $2`,
      [
        attempt.organizationId,
        attempt.payableId,
        normalizePaymentMethod(transaction.channel || attempt.method),
        attempt.reference,
        transaction.providerReference,
        paidAt,
      ]
    );
  }
  return { ...recorded, receipt, payable };
};

export const toSafePaymentResult = ({ payment, application, receipt }, idempotentReplay = false) => ({
  payment: payment ? {
    reference: payment.reference,
    businessUnit: payment.businessUnit,
    amountCents: Number(payment.amountCents || 0),
    currency: payment.currency,
    method: normalizePaymentMethod(payment.method),
    provider: payment.provider,
    providerReference: payment.providerReference,
    status: payment.status,
    verificationStatus: payment.verificationStatus,
    paidAt: payment.paidAt,
  } : null,
  application: application ? {
    payableType: application.payableType,
    payableId: Number(application.payableId),
    businessUnit: application.businessUnit,
    amountCents: Number(application.amountCents),
    status: application.status,
  } : null,
  receipt: receipt ? { id: receipt.id, receiptNumber: receipt.receiptNumber } : null,
  idempotentReplay,
});
