import { normalizePaymentMethod, normalizeExternalReference } from "../payments/paymentDomain.js";
import { createInternalPaymentReference, createPaymentRecordAndApplication } from "../payments/paymentPersistence.js";
import { deriveWaterSettlement } from "../../../shared/waterSettlement.js";
import { writeAuditLog } from "../../functions/_shared/auditLog.js";

export const waterSettlementError = (message, code, statusCode = 409) =>
  Object.assign(new Error(message), { code, statusCode });

export const loadWaterAppliedCollections = async (client, organizationId, saleId) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(pa."amountCents"), 0)::bigint AS "amountPaidCents",
            COUNT(*)::int AS "applicationCount", MAX(pr."paidAt") AS "lastPaidAt"
     FROM "paymentApplication" pa
     JOIN "paymentRecord" pr ON pr.id = pa."paymentId" AND pr."organizationId" = pa."organizationId"
     WHERE pa."organizationId" = $1 AND pa."payableId" = $2
       AND pa."payableType" = 'WATER_ORDER' AND pa."businessUnit" = 'WATER'
       AND pa.status = 'APPLIED' AND pr.status = 'PAID' AND pr."businessUnit" = 'WATER'`,
    [organizationId, saleId]
  );
  return result.rows[0] || { amountPaidCents: 0, applicationCount: 0 };
};

export const projectWaterSettlement = async (client, sale, applications) => {
  const totals = applications || await loadWaterAppliedCollections(client, sale.organizationId, sale.id);
  const projection = deriveWaterSettlement(sale, totals);
  // Never turn an unverified legacy fact into an authoritative payment projection.
  if (!projection.legacyPaymentCompatibility) {
    await client.query(
      `UPDATE "waterSale" SET "paymentStatus" = $3, "paidAt" = $4,
         "updatedAt" = GREATEST(clock_timestamp(), COALESCE("updatedAt", "createdAt") + INTERVAL '1 millisecond')
       WHERE "organizationId" = $1 AND id = $2 AND "productKey" = $5 AND "archivedAt" IS NULL`,
      [sale.organizationId, sale.id, projection.paymentStatus,
        projection.paymentStatus === "paid" ? totals.lastPaidAt || null : null, sale.productKey]
    );
  }
  return projection;
};

export const validateWaterCollection = (input) => {
  const method = normalizePaymentMethod(input.method);
  const amountCents = Number(input.amountCents);
  const providerReference = normalizeExternalReference(input.providerReference);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100000000) {
    throw waterSettlementError("Enter a positive collection amount in pesewas.", "INVALID_PAYMENT_AMOUNT", 400);
  }
  if (!["Cash", "Mobile Money", "Bank Transfer", "Card"].includes(method)) {
    throw waterSettlementError("Choose a supported collection method.", "INVALID_PAYMENT_METHOD", 400);
  }
  if (method !== "Cash" && !providerReference) {
    throw waterSettlementError("An electronic transaction reference is required.", "INVALID_PAYMENT_REFERENCE", 400);
  }
  if (!/^[A-Za-z0-9:_-]{12,160}$/.test(String(input.idempotencyKey || ""))) {
    throw waterSettlementError("A valid collection idempotency key is required.", "IDEMPOTENCY_KEY_REQUIRED", 400);
  }
  if (String(input.currency || "GHS").toUpperCase() !== "GHS") {
    throw waterSettlementError("Water collections must use GHS.", "PAYMENT_CURRENCY_MISMATCH", 400);
  }
  const parsedDate = new Date(input.paidAt || "");
  if (Number.isNaN(parsedDate.getTime())) {
    throw waterSettlementError("A valid collection date is required.", "INVALID_PAYMENT_DATE", 400);
  }
  if (parsedDate.getTime() > Date.now() + 60000) {
    throw waterSettlementError("A collection cannot be dated in the future.", "INVALID_PAYMENT_DATE", 400);
  }
  return { amountCents, method, providerReference, paidAt: parsedDate.toISOString() };
};

// Caller owns BEGIN/COMMIT. Sale and collection creation must share that transaction.
// This reuses the shared immutable records; it never creates Core accounting rows.
export const recordWaterCollection = async (client, input) => {
  const normalized = validateWaterCollection(input);
  const { organizationId, saleId, productKey } = input;
  const provider = input.source === "ONLINE_PROVIDER" ? String(input.provider || "").toUpperCase() : "MANUAL_WATER";
  // All entry points, including providers which already lock their payable,
  // take the sale lock before the shared reference/idempotency locks.
  const result = await client.query(
    `SELECT * FROM "waterSale" WHERE "organizationId" = $1 AND id = $2
       AND "productKey" = $3 AND "archivedAt" IS NULL FOR UPDATE`,
    [organizationId, saleId, productKey]
  );
  const sale = result.rows[0];
  if (!sale) throw waterSettlementError("Water sale not found.", "WATER_SALE_NOT_FOUND", 404);
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`water-collection:${organizationId}:${input.idempotencyKey}`]);
  const replayResult = await client.query(
    `SELECT pr.*, pa."payableId", pa."payableType", w."productKey"
     FROM "paymentRecord" pr
     JOIN "paymentApplication" pa ON pa."paymentId" = pr.id AND pa."organizationId" = pr."organizationId"
     JOIN "waterSale" w ON w.id = pa."payableId" AND w."organizationId" = pa."organizationId"
     WHERE pr."organizationId" = $1 AND pr."idempotencyKey" = $2
       AND pr."businessUnit" = 'WATER' AND pa."businessUnit" = 'WATER' AND pa."payableType" = 'WATER_ORDER'`,
    [organizationId, input.idempotencyKey]
  );
  const replay = replayResult.rows[0];
  if (replay) {
    if (Number(replay.payableId) !== Number(saleId) || replay.productKey !== productKey
      || Number(replay.amountCents) !== normalized.amountCents || replay.method !== normalized.method
      || (replay.providerReference || null) !== normalized.providerReference
      || new Date(replay.paidAt).toISOString() !== normalized.paidAt || replay.provider !== provider) {
      throw waterSettlementError("This request key belongs to a different collection.", "IDEMPOTENCY_CONFLICT");
    }
    return { payment: replay, application: { payableId: Number(saleId), payableType: "WATER_ORDER", businessUnit: "WATER", amountCents: normalized.amountCents, status: "APPLIED" }, idempotentReplay: true };
  }
  if (normalized.providerReference) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`water-reference:${organizationId}:${provider}:${normalized.providerReference.toLowerCase()}`]);
    const duplicate = await client.query(
      `SELECT id FROM "paymentRecord" WHERE "organizationId" = $1 AND provider = $2
       AND LOWER(TRIM("providerReference")) = LOWER(TRIM($3)) AND status = 'PAID' LIMIT 1`,
      [organizationId, provider, normalized.providerReference]
    );
    if (duplicate.rows.length) throw waterSettlementError("This transaction reference already belongs to a payment.", "DUPLICATE_PAYMENT_REFERENCE");
  }
  const before = deriveWaterSettlement(sale, await loadWaterAppliedCollections(client, organizationId, saleId));
  if (before.legacyPaymentCompatibility) throw waterSettlementError("This sale has legacy paid information. Reconcile it before recording another collection.", "WATER_LEGACY_PAYMENT_RECONCILIATION");
  if (normalized.amountCents > before.balanceDueCents) throw waterSettlementError("Collection exceeds the remaining Water sale balance.", "PAYMENT_OVERAPPLICATION");
  const recorded = await createPaymentRecordAndApplication(client, {
    organizationId, customerId: sale.customerId || null, attemptId: input.attemptId || null,
    reference: input.reference || createInternalPaymentReference("WATER", organizationId),
    businessUnit: "WATER", ...normalized, currency: "GHS", provider,
    source: input.source === "ONLINE_PROVIDER" ? "ONLINE_PROVIDER" : "MANUAL",
    verificationStatus: input.source === "ONLINE_PROVIDER" ? "VERIFIED" : "MANUAL",
    recordedByUserId: input.actor?.userId || null, notes: String(input.notes || "").trim().slice(0, 500) || null,
    idempotencyKey: input.idempotencyKey, payableType: "WATER_ORDER", payableId: saleId, orderPaymentId: null,
  });
  const projection = await projectWaterSettlement(client, sale);
  await writeAuditLog(client, {
    organizationId, userId: input.actor?.userId || null, action: "WATER_COLLECTION_RECORDED",
    targetType: "waterSale", targetId: String(saleId), category: "finance", status: "ok",
    requestId: input.requestId, summary: "Water collection recorded.",
    metadata: { businessUnit: "WATER", productKey, paymentId: recorded.payment.id,
      amountCents: normalized.amountCents, method: normalized.method,
      balanceDueCents: projection.balanceDueCents, paymentStatus: projection.paymentStatus },
  });
  return { ...recorded, projection, idempotentReplay: false };
};

export const assertWaterCommercialEdit = (sale, payload, settlement, nextTotal, nextCustomerId) => {
  for (const field of ["paymentMethod", "paymentStatus", "paymentReference", "providerReference", "paidAt"]) {
    if (Object.hasOwn(payload, field) && String(payload[field] ?? "") !== String(sale[field] ?? "")) {
      throw waterSettlementError("Use Record Collection to change payment facts; Edit Sale only changes commercial details.", "WATER_COLLECTION_REQUIRED");
    }
  }
  if (settlement.legacyPaymentCompatibility && Number(nextTotal) !== Number(sale.totalAmount)) {
    throw waterSettlementError("Reconcile this legacy paid sale before changing its total.", "WATER_LEGACY_PAYMENT_RECONCILIATION");
  }
  if (Number(nextTotal) < settlement.amountPaidCents) {
    throw waterSettlementError("The corrected total is below money already collected. A reviewed refund is required first.", "WATER_REFUND_REQUIRED");
  }
  if (settlement.amountPaidCents > 0 && Number(nextCustomerId || 0) !== Number(sale.customerId || 0)) {
    throw waterSettlementError("A collected sale cannot be reassigned to another customer without reconciliation.", "WATER_CUSTOMER_RECONCILIATION_REQUIRED");
  }
};
