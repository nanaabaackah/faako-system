import crypto from "node:crypto";
import { cleanPaymentText, normalizePaymentMethod } from "./paymentDomain.js";

const stableJson = (value) => JSON.stringify(value, Object.keys(value || {}).sort());

export const fingerprintPaymentRequest = (value) =>
  crypto.createHash("sha256").update(stableJson(value)).digest("hex");

export const fingerprintProviderEvent = (rawBody) =>
  crypto.createHash("sha256").update(String(rawBody || ""), "utf8").digest("hex");

export const createInternalPaymentReference = (businessUnit = "REEBS_CORE", organizationId) => {
  const prefix = businessUnit === "WATER" ? "REEBS-WATER" : "REEBS-PAY";
  const scopedOrganizationId = Number(organizationId);
  if (!Number.isInteger(scopedOrganizationId) || scopedOrganizationId <= 0) {
    throw new Error("A valid organization is required for a payment reference.");
  }
  return `${prefix}-O${scopedOrganizationId}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
};

export const parsePaymentReferenceOrganizationId = (reference) => {
  const match = String(reference || "").trim().match(/^REEBS-(?:PAY|WATER)-O([1-9][0-9]*)-/i);
  if (!match) return null;
  const organizationId = Number(match[1]);
  return Number.isSafeInteger(organizationId) ? organizationId : null;
};

export const toPaymentAttemptDto = (row = {}) => ({
  reference: row.reference || null,
  businessUnit: row.businessUnit || null,
  payable: {
    type: row.payableType || null,
    id: Number(row.payableId) || null,
  },
  amountCents: Number(row.amountCents || 0),
  currency: row.currency || null,
  method: normalizePaymentMethod(row.method),
  provider: row.provider || null,
  status: row.status || null,
  verificationStatus: row.verificationStatus || null,
  authorizationUrl: row.authorizationUrl || null,
  accessCode: row.accessCode || null,
  expiresAt: row.expiresAt || null,
  paidAt: row.paidAt || null,
  createdAt: row.createdAt || null,
});

export const createOrReusePaymentAttempt = async (client, input) => {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `payment-attempt:${input.organizationId}:${input.idempotencyKey}`,
  ]);
  const existing = await client.query(
    `SELECT * FROM "paymentAttempt"
     WHERE "organizationId" = $1 AND "idempotencyKey" = $2
     LIMIT 1`,
    [input.organizationId, input.idempotencyKey]
  );
  const row = existing.rows?.[0];
  if (row) {
    if (row.requestFingerprint !== input.requestFingerprint) {
      const error = new Error("This idempotency key was already used for a different payment request.");
      error.statusCode = 409;
      error.code = "IDEMPOTENCY_CONFLICT";
      throw error;
    }
    return { attempt: row, created: false };
  }
  const result = await client.query(
    `INSERT INTO "paymentAttempt" (
       "organizationId", "customerId", reference, "businessUnit", "payableType", "payableId",
       "amountCents", currency, method, provider, status, "verificationStatus",
       "idempotencyKey", "requestFingerprint", "expiresAt", "createdByUserId", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING','UNVERIFIED',$11,$12,$13,$14,NOW(),NOW())
     RETURNING *`,
    [
      input.organizationId,
      input.customerId,
      input.reference,
      input.businessUnit,
      input.payableType,
      input.payableId,
      input.amountCents,
      input.currency,
      input.method,
      input.provider,
      input.idempotencyKey,
      input.requestFingerprint,
      input.expiresAt,
      input.createdByUserId,
    ]
  );
  return { attempt: result.rows[0], created: true };
};

export const assertNoActivePaymentAttempt = async (
  client,
  { organizationId, payableType, payableId }
) => {
  await client.query(
    `UPDATE "paymentAttempt"
     SET status = 'CANCELLED', "failureCode" = 'ATTEMPT_EXPIRED', "updatedAt" = NOW()
     WHERE "organizationId" = $1 AND "payableType" = $2 AND "payableId" = $3
       AND status = 'PENDING' AND "expiresAt" IS NOT NULL AND "expiresAt" <= NOW()`,
    [organizationId, payableType, payableId]
  );
  const result = await client.query(
    `SELECT reference FROM "paymentAttempt"
     WHERE "organizationId" = $1 AND "payableType" = $2 AND "payableId" = $3
       AND status = 'PENDING'
     LIMIT 1`,
    [organizationId, payableType, payableId]
  );
  if (result.rowCount > 0) {
    const error = new Error("A payment attempt is already in progress for this record.");
    error.statusCode = 409;
    error.code = "PAYMENT_ATTEMPT_IN_PROGRESS";
    throw error;
  }
};

export const markPaymentAttemptInitialized = async (
  client,
  { organizationId, reference, providerReference, authorizationUrl, accessCode }
) => {
  const result = await client.query(
    `UPDATE "paymentAttempt"
     SET "providerReference" = $3, "authorizationUrl" = $4, "accessCode" = $5, "updatedAt" = NOW()
     WHERE "organizationId" = $1 AND reference = $2 AND status = 'PENDING'
     RETURNING *`,
    [organizationId, reference, providerReference, authorizationUrl, accessCode]
  );
  return result.rows?.[0] || null;
};

export const markPaymentAttemptInitializationFailed = async (
  client,
  { organizationId, reference, code }
) => {
  await client.query(
    `UPDATE "paymentAttempt"
     SET status = 'FAILED', "verificationStatus" = 'FAILED', "failureCode" = $3,
         "failureMessage" = 'Provider initialization failed.', "updatedAt" = NOW()
     WHERE "organizationId" = $1 AND reference = $2
       AND status = 'PENDING' AND "providerReference" IS NULL`,
    [organizationId, reference, cleanPaymentText(code, 80) || "PAYMENT_PROVIDER_FAILED"]
  );
};

export const findPaymentAttempt = async (
  client,
  { organizationId = null, reference, forUpdate = false }
) => {
  const params = [cleanPaymentText(reference, 160)];
  const organizationFilter = organizationId
    ? (params.push(organizationId), `AND "organizationId" = $2`)
    : "";
  const result = await client.query(
    `SELECT * FROM "paymentAttempt"
     WHERE (reference = $1 OR "providerReference" = $1)
       ${organizationFilter}
     ORDER BY id DESC
     LIMIT 1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    params
  );
  return result.rows?.[0] || null;
};

export const findPaymentAttemptByIdempotency = async (
  client,
  { organizationId, idempotencyKey }
) => {
  const result = await client.query(
    `SELECT * FROM "paymentAttempt"
     WHERE "organizationId" = $1 AND "idempotencyKey" = $2
     LIMIT 1`,
    [organizationId, idempotencyKey]
  );
  return result.rows?.[0] || null;
};

export const findPaymentRecordForAttempt = async (client, attemptId) => {
  const result = await client.query(
    `SELECT * FROM "paymentRecord" WHERE "attemptId" = $1 LIMIT 1`,
    [attemptId]
  );
  return result.rows?.[0] || null;
};

export const findPaymentRecordForOrderPayment = async (client, orderPaymentId) => {
  const result = await client.query(
    `SELECT pr.*, pa."payableType", pa."payableId", pa."businessUnit" AS "applicationBusinessUnit",
            pa."amountCents" AS "applicationAmountCents", pa.status AS "applicationStatus"
     FROM "paymentApplication" pa
     JOIN "paymentRecord" pr ON pr.id = pa."paymentId" AND pr."organizationId" = pa."organizationId"
     WHERE pa."orderPaymentId" = $1
     LIMIT 1`,
    [orderPaymentId]
  );
  return result.rows?.[0] || null;
};

export const insertProviderEvent = async (client, input) => {
  const result = await client.query(
    `INSERT INTO "paymentProviderEvent" (
       "organizationId", "attemptId", provider, "eventType", fingerprint,
       "providerReference", status, "receivedAt", "createdAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,'RECEIVED',NOW(),NOW())
     ON CONFLICT (provider, fingerprint) DO NOTHING
     RETURNING *`,
    [
      input.organizationId,
      input.attemptId,
      input.provider,
      input.eventType,
      input.fingerprint,
      input.providerReference,
    ]
  );
  return { event: result.rows?.[0] || null, duplicate: result.rowCount === 0 };
};

export const markProviderEvent = async (client, eventId, status, errorCode = null) => {
  if (!eventId) return;
  await client.query(
    `UPDATE "paymentProviderEvent"
     SET status = $2, "errorCode" = $3, "processedAt" = NOW()
     WHERE id = $1`,
    [eventId, status, errorCode]
  );
};

export const createPaymentRecordAndApplication = async (client, input) => {
  const paymentResult = await client.query(
    `INSERT INTO "paymentRecord" (
       "organizationId", "customerId", "attemptId", reference, "businessUnit",
       "amountCents", currency, method, provider, "providerReference", source,
       status, "verificationStatus", "paidAt", "recordedByUserId", notes,
       "idempotencyKey", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PAID',$12,$13,$14,$15,$16,NOW(),NOW())
     RETURNING *`,
    [
      input.organizationId,
      input.customerId,
      input.attemptId,
      input.reference,
      input.businessUnit,
      input.amountCents,
      input.currency,
      input.method,
      input.provider,
      input.providerReference,
      input.source,
      input.verificationStatus,
      input.paidAt,
      input.recordedByUserId,
      input.notes || null,
      input.idempotencyKey,
    ]
  );
  const payment = paymentResult.rows[0];
  const applicationResult = await client.query(
    `INSERT INTO "paymentApplication" (
       "organizationId", "customerId", "paymentId", "orderPaymentId", "businessUnit",
       "payableType", "payableId", "amountCents", currency, status, "appliedAt", "createdAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'APPLIED',$10,NOW())
     RETURNING *`,
    [
      input.organizationId,
      input.customerId,
      payment.id,
      input.orderPaymentId || null,
      input.businessUnit,
      input.payableType,
      input.payableId,
      input.amountCents,
      input.currency,
      input.paidAt,
    ]
  );
  return { payment, application: applicationResult.rows[0] };
};
