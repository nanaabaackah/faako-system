import { recordManualOrderPayment } from "./manualPaymentService.js";
import { writeAuditLog } from "../../functions/_shared/auditLog.js";
import { cleanPaymentText } from "./paymentDomain.js";
import { calculatePayableCharge, loadPayable, normalizePayableType, PAYABLE_TYPES } from "./payableRepository.js";
import {
  applyPaymentToPayable,
  toSafePaymentResult,
  validateProviderTransaction,
} from "./paymentApplicationService.js";
import {
  createInternalPaymentReference,
  createOrReusePaymentAttempt,
  assertNoActivePaymentAttempt,
  createPaymentRecordAndApplication,
  findPaymentAttempt,
  findPaymentAttemptByIdempotency,
  findPaymentRecordForAttempt,
  findPaymentRecordForOrderPayment,
  fingerprintPaymentRequest,
  insertProviderEvent,
  markPaymentAttemptInitializationFailed,
  markPaymentAttemptInitialized,
  markProviderEvent,
  toPaymentAttemptDto,
} from "./paymentPersistence.js";
import { getOnlinePaymentProvider } from "./paymentProviderRegistry.js";

const ATTEMPT_TTL_MS = 30 * 60 * 1000;

const setPaymentTenantContext = async (client, organizationId) => {
  const id = Number(organizationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw paymentError("Organization access is required.", "ORGANIZATION_REQUIRED", 403);
  }
  // A dedicated pg Client is used per API request. Session scope is deliberate:
  // the existing set_org_context helper is transaction-local and would expire
  // before Payment Service starts its own financial transaction.
  await client.query("SELECT set_config('app.current_organization_id', $1, false)", [String(id)]);
};

const paymentError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const requireIdempotencyKey = (value) => {
  const key = cleanPaymentText(value, 160);
  if (key.length < 8) throw paymentError(
    "Idempotency-Key is required for payment initialization.",
    "IDEMPOTENCY_KEY_REQUIRED"
  );
  return key;
};

const validateCustomerEmail = (payable) => {
  const email = cleanPaymentText(payable.customerEmail, 254).toLowerCase();
  if (!email || !email.includes("@")) {
    throw paymentError(
      "The customer needs a valid email address before an online payment can be initialized.",
      "CUSTOMER_EMAIL_REQUIRED",
      409
    );
  }
  return email;
};

export const initializePayment = async (client, input = {}, dependencies = {}) => {
  const organizationId = Number(input.organizationId);
  const payableType = normalizePayableType(input.payableType);
  const payableId = Number(input.payableId);
  const providerName = cleanPaymentText(input.provider || "PAYSTACK", 40).toUpperCase();
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  let prepared;

  await setPaymentTenantContext(client, organizationId);
  const normalizedRequestedPurpose = cleanPaymentText(input.purpose || "AUTO", 20).toUpperCase();
  const requestFingerprint = fingerprintPaymentRequest({
    organizationId,
    payableType,
    payableId,
    purpose: normalizedRequestedPurpose,
    provider: providerName,
  });
  const existingAttempt = await findPaymentAttemptByIdempotency(client, {
    organizationId,
    idempotencyKey,
  });
  if (existingAttempt) {
    if (existingAttempt.requestFingerprint !== requestFingerprint) {
      throw paymentError(
        "This idempotency key was already used for a different payment request.",
        "IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return {
      attempt: toPaymentAttemptDto(existingAttempt),
      idempotentReplay: true,
      initializing: existingAttempt.status === "PENDING" && !existingAttempt.authorizationUrl,
    };
  }
  await client.query("BEGIN");
  try {
    const payable = await loadPayable(client, {
      organizationId,
      payableType,
      payableId,
      forUpdate: true,
    });
    const charge = calculatePayableCharge(payable, input.purpose);
    const customerEmail = validateCustomerEmail(payable);
    await assertNoActivePaymentAttempt(client, {
      organizationId,
      payableType: payable.type,
      payableId: payable.id,
    });
    const result = await createOrReusePaymentAttempt(client, {
      organizationId,
      customerId: payable.customerId,
      reference: createInternalPaymentReference(payable.businessUnit, organizationId),
      businessUnit: payable.businessUnit,
      payableType: payable.type,
      payableId: payable.id,
      amountCents: charge.amountCents,
      currency: payable.currency,
      method: "Mobile Money",
      provider: providerName,
      idempotencyKey,
      requestFingerprint,
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS).toISOString(),
      createdByUserId: input.actor?.userId || null,
    });
    prepared = { ...result, payable, charge, customerEmail };
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }

  if (!prepared.created) {
    return {
      attempt: toPaymentAttemptDto(prepared.attempt),
      idempotentReplay: true,
      initializing: prepared.attempt.status === "PENDING" && !prepared.attempt.authorizationUrl,
    };
  }

  const provider = dependencies.provider || getOnlinePaymentProvider(providerName, dependencies.providerOptions);
  try {
    const initialized = await provider.initializePayment({
      email: prepared.customerEmail,
      amountCents: prepared.attempt.amountCents,
      currency: prepared.attempt.currency,
      reference: prepared.attempt.reference,
      callbackUrl: cleanPaymentText(process.env.PAYSTACK_CALLBACK_URL, 500) || undefined,
      channels: ["mobile_money", "card"],
    });
    if (initialized.providerReference !== prepared.attempt.reference) {
      throw paymentError(
        "The provider returned an unexpected payment reference.",
        "PAYMENT_REFERENCE_MISMATCH",
        502
      );
    }
    const updated = await markPaymentAttemptInitialized(client, {
      organizationId,
      reference: prepared.attempt.reference,
      providerReference: initialized.providerReference,
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
    });
    return {
      attempt: toPaymentAttemptDto(updated || prepared.attempt),
      idempotentReplay: false,
      initializing: false,
    };
  } catch (error) {
    await markPaymentAttemptInitializationFailed(client, {
      organizationId,
      reference: prepared.attempt.reference,
      code: error?.code,
    }).catch(() => {});
    throw error;
  }
};

export const finalizeVerifiedPayment = async (client, input = {}) => {
  let eventRow = null;
  await setPaymentTenantContext(client, input.organizationId);
  await client.query("BEGIN");
  try {
    const attempt = await findPaymentAttempt(client, {
      organizationId: input.organizationId || null,
      reference: input.reference,
      forUpdate: true,
    });
    if (!attempt) throw paymentError("Payment attempt was not found.", "PAYMENT_ATTEMPT_NOT_FOUND", 404);

    if (input.event) {
      const eventResult = await insertProviderEvent(client, {
        organizationId: attempt.organizationId,
        attemptId: attempt.id,
        provider: attempt.provider,
        eventType: input.event.type,
        fingerprint: input.event.fingerprint,
        providerReference: input.transaction?.providerReference || input.reference,
      });
      if (eventResult.duplicate) {
        const existingPayment = await findPaymentRecordForAttempt(client, attempt.id);
        await client.query("COMMIT");
        return toSafePaymentResult({ payment: existingPayment }, true);
      }
      eventRow = eventResult.event;
    }

    const existingPayment = await findPaymentRecordForAttempt(client, attempt.id);
    if (existingPayment || attempt.status === "PAID") {
      await markProviderEvent(client, eventRow?.id, "PROCESSED");
      await client.query("COMMIT");
      return toSafePaymentResult({ payment: existingPayment }, true);
    }

    try {
      validateProviderTransaction(attempt, input.transaction || {});
      const applied = await applyPaymentToPayable(client, attempt, input.transaction, input.actor);
      await client.query(
        `UPDATE "paymentAttempt"
         SET status = 'PAID', "verificationStatus" = 'VERIFIED', "paidAt" = $3,
             "lastVerifiedAt" = NOW(), "failureCode" = NULL, "failureMessage" = NULL, "updatedAt" = NOW()
         WHERE "organizationId" = $1 AND id = $2`,
        [attempt.organizationId, attempt.id, applied.payment.paidAt]
      );
      await markProviderEvent(client, eventRow?.id, "PROCESSED");
      await writeAuditLog(client, {
        userId: input.actor?.userId || null,
        organizationId: attempt.organizationId,
        action: "PAYMENT_VERIFIED_AND_APPLIED",
        targetType: "payment",
        targetId: attempt.reference,
        source: input.event ? "webhook" : "api",
        category: "payment",
        severity: "info",
        status: "ok",
        summary: `Verified payment for ${attempt.payableType} ${attempt.payableId}.`,
        actorLabel: input.actor?.userName || (input.event ? "Paystack webhook" : "Internal user"),
        requestId: input.requestId || null,
        metadata: {
          payableType: attempt.payableType,
          payableId: attempt.payableId,
          amountCents: attempt.amountCents,
          currency: attempt.currency,
          businessUnit: attempt.businessUnit,
        },
      });
      await client.query("COMMIT");
      return toSafePaymentResult(applied, false);
    } catch (error) {
      const mismatch = ["PAYMENT_REFERENCE_MISMATCH", "PAYMENT_AMOUNT_MISMATCH", "PAYMENT_CURRENCY_MISMATCH", "PAYMENT_RELATIONSHIP_MISMATCH", "PAYMENT_OVERAPPLICATION", "PAYMENT_NOT_SUCCESSFUL"].includes(error?.code);
      if (!mismatch) throw error;
      await client.query(
        `UPDATE "paymentAttempt"
         SET "verificationStatus" = $3, "failureCode" = $4,
             "failureMessage" = 'Payment verification requires reconciliation.',
             "lastVerifiedAt" = NOW(), "updatedAt" = NOW()
         WHERE "organizationId" = $1 AND id = $2`,
        [attempt.organizationId, attempt.id, error.code === "PAYMENT_NOT_SUCCESSFUL" ? "FAILED" : "MISMATCH", error.code]
      );
      await markProviderEvent(client, eventRow?.id, "FAILED", error.code);
      await client.query("COMMIT");
      throw error;
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};

export const verifyPayment = async (client, input = {}, dependencies = {}) => {
  await setPaymentTenantContext(client, input.organizationId);
  const attempt = await findPaymentAttempt(client, {
    organizationId: input.organizationId,
    reference: input.reference,
  });
  if (!attempt) throw paymentError("Payment attempt was not found.", "PAYMENT_ATTEMPT_NOT_FOUND", 404);
  if (attempt.status === "PAID") {
    const payment = await findPaymentRecordForAttempt(client, attempt.id);
    return toSafePaymentResult({ payment }, true);
  }
  const provider = dependencies.provider || getOnlinePaymentProvider(attempt.provider, dependencies.providerOptions);
  const transaction = await provider.verifyPayment(attempt.providerReference || attempt.reference);
  return finalizeVerifiedPayment(client, {
    organizationId: input.organizationId,
    reference: attempt.reference,
    transaction,
    actor: input.actor,
    requestId: input.requestId,
  });
};

export const recordManualPayment = async (client, input = {}) => {
  const organizationId = Number(input.organizationId);
  const payableType = normalizePayableType(input.payableType);
  if (payableType !== PAYABLE_TYPES.ORDER) {
    throw paymentError(
      "Manual payments are currently connected to Core orders only. Booking, invoice, and Water recording require their owning workflow.",
      "MANUAL_PAYMENT_CONTEXT_NOT_CONNECTED",
      409
    );
  }
  await setPaymentTenantContext(client, organizationId);
  await client.query("BEGIN");
  try {
    const payable = await loadPayable(client, {
      organizationId,
      payableType,
      payableId: input.payableId,
      forUpdate: true,
    });
    const amountCents = Math.round(Number(input.amountCents || 0));
    const balance = calculatePayableCharge(payable, "BALANCE");
    if (amountCents <= 0 || amountCents > balance.balanceDueCents) {
      throw paymentError(
        "Manual payment must be greater than zero and no more than the trusted balance due.",
        "INVALID_PAYMENT_AMOUNT"
      );
    }
    const orderResult = await recordManualOrderPayment(client, {
      organizationId,
      orderId: payable.id,
      amountCents,
      method: input.method,
      provider: input.provider || null,
      transactionReference: input.transactionReference || null,
      phoneNumber: input.phoneNumber || null,
      notes: input.notes || null,
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
    });
    const existing = await findPaymentRecordForOrderPayment(client, orderResult.payment.id);
    if (existing) {
      await client.query("COMMIT");
      return {
        ...orderResult,
        universalPayment: toSafePaymentResult({ payment: existing }, true),
        idempotentReplay: true,
      };
    }
    const paidAt = orderResult.payment.paidAt || new Date().toISOString();
    const recorded = await createPaymentRecordAndApplication(client, {
      organizationId,
      customerId: payable.customerId,
      attemptId: null,
      reference: createInternalPaymentReference(payable.businessUnit, organizationId),
      businessUnit: payable.businessUnit,
      amountCents,
      currency: payable.currency,
      method: orderResult.payment.method,
      provider: orderResult.payment.provider || "MANUAL",
      providerReference: orderResult.payment.transactionReference || null,
      source: "MANUAL",
      verificationStatus: "MANUAL",
      paidAt,
      recordedByUserId: input.actor?.userId || null,
      notes: input.notes || null,
      idempotencyKey: `manual:${input.idempotencyKey}`,
      payableType,
      payableId: payable.id,
      orderPaymentId: orderResult.payment.id,
    });
    await writeAuditLog(client, {
      userId: input.actor?.userId || null,
      organizationId,
      action: "PAYMENT_MANUALLY_RECORDED",
      targetType: "payment",
      targetId: recorded.payment.reference,
      source: "api",
      category: "payment",
      severity: "info",
      status: "ok",
      summary: `Recorded manual payment for ORDER ${payable.id}.`,
      actorLabel: input.actor?.userName || "Internal user",
      requestId: input.requestId || null,
      metadata: {
        payableType,
        payableId: payable.id,
        amountCents,
        currency: payable.currency,
        businessUnit: payable.businessUnit,
      },
    });
    await client.query("COMMIT");
    return {
      ...orderResult,
      universalPayment: toSafePaymentResult(recorded, false),
      idempotentReplay: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};
