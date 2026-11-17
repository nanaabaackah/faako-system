import { recordWaterCollection, loadWaterAppliedCollections, projectWaterSettlement, waterSettlementError } from "./settlement.js";
import { deriveWaterSettlement } from "../../../shared/waterSettlement.js";
import { writeAuditLog } from "../../functions/_shared/auditLog.js";

const requireReason = (value) => {
  const reason = String(value || "").trim();
  if (reason.length < 5 || reason.length > 500) {
    throw waterSettlementError("Explain the payment correction in 5 to 500 characters.", "WATER_CORRECTION_REASON_REQUIRED", 400);
  }
  return reason;
};

const lockSale = async (client, { organizationId, saleId, productKey }) => {
  const result = await client.query(
    `SELECT * FROM "waterSale" WHERE "organizationId" = $1 AND id = $2 AND "productKey" = $3
       AND "archivedAt" IS NULL FOR UPDATE`,
    [organizationId, saleId, productKey]
  );
  if (!result.rows[0]) throw waterSettlementError("The Water order is unavailable.", "WATER_SALE_NOT_FOUND", 404);
  return result.rows[0];
};

const recordCorrection = async (client, input) => {
  const result = await client.query(
    `INSERT INTO "waterPaymentCorrection"
       ("organizationId", "productKey", "saleId", "originalPaymentId", "replacementPaymentId",
        "correctionType", "previousSalePaymentStatus", reason, "actorId", "idempotencyKey")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [input.organizationId, input.productKey, input.saleId, input.originalPaymentId || null,
      input.replacementPaymentId || null, input.correctionType, input.previousSalePaymentStatus || null,
      input.reason, input.actorId, input.idempotencyKey]
  );
  await writeAuditLog(client, {
    organizationId: input.organizationId, userId: input.actorId,
    action: "WATER_PAYMENT_" + input.correctionType,
    targetType: "waterSale", targetId: String(input.saleId),
    category: "finance", status: "ok", requestId: input.requestId,
    summary: "Water payment reconciliation recorded.",
    metadata: { businessUnit: "WATER", productKey: input.productKey,
      originalPaymentId: input.originalPaymentId || null,
      replacementPaymentId: input.replacementPaymentId || null,
      reason: input.reason, correctionId: result.rows[0]?.id },
  });
  return result.rows[0];
};

// All callers must run in runWaterCommand's transaction. Do not edit the original
// payment facts: reverse its application, supersede it, and post a new receipt.
export const correctManualWaterPayment = async (client, input) => {
  const reason = requireReason(input.reason);
  const sale = await lockSale(client, input);
  const paymentId = Number(input.paymentId);
  if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
    throw waterSettlementError("Select a valid recorded payment.", "WATER_PAYMENT_REQUIRED", 400);
  }
  const locked = await client.query(
    `SELECT pr.*, pa.id AS "applicationId", pa."amountCents" AS "appliedAmountCents",
            pa.status AS "applicationStatus"
       FROM "paymentRecord" pr JOIN "paymentApplication" pa
         ON pa."paymentId" = pr.id AND pa."organizationId" = pr."organizationId"
       WHERE pr.id = $1 AND pr."organizationId" = $2
         AND pr."businessUnit" = 'WATER' AND pr.currency = 'GHS'
         AND pa."businessUnit" = 'WATER' AND pa."payableType" = 'WATER_ORDER'
         AND pa."payableId" = $3 AND pa.currency = 'GHS'
       FOR UPDATE OF pr, pa`,
    [paymentId, input.organizationId, input.saleId]
  );
  const payment = locked.rows[0];
  if (!payment) throw waterSettlementError("Payment does not belong to this Water order.", "WATER_PAYMENT_NOT_FOUND", 404);
  if (payment.source !== "MANUAL" || payment.provider !== "MANUAL_WATER"
    || payment.verificationStatus !== "MANUAL" || payment.attemptId) {
    throw waterSettlementError("Provider-verified payments require a separate provider review.", "WATER_PROVIDER_CORRECTION_BLOCKED");
  }
  if (payment.supersededAt || payment.applicationStatus !== "APPLIED") {
    throw waterSettlementError("This collection has already been corrected or reversed. Refresh its history.", "WATER_COLLECTION_ALREADY_CORRECTED");
  }
  const related = await client.query(
    `SELECT id, "payableId", "payableType", "businessUnit", status
       FROM "paymentApplication"
       WHERE "organizationId" = $1 AND "paymentId" = $2 ORDER BY id FOR UPDATE`,
    [input.organizationId, paymentId]
  );
  if (related.rows.length !== 1 || Number(related.rows[0].id) !== Number(payment.applicationId)) {
    throw waterSettlementError("This receipt has been used for customer credit or another order. Review the credit allocations before correcting it.", "WATER_CREDIT_ALREADY_USED");
  }
  const replacing = input.mode === "replace";
  if (!replacing && input.mode !== "reverse") {
    throw waterSettlementError("Choose replace or reverse for this payment.", "WATER_CORRECTION_MODE_INVALID", 400);
  }
  await client.query(
    `UPDATE "paymentApplication" SET status = 'REVERSED'
       WHERE id = $1 AND "organizationId" = $2 AND status = 'APPLIED'`,
    [payment.applicationId, input.organizationId]
  );
  await client.query(
    `UPDATE "paymentRecord" SET "supersededAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1 AND "organizationId" = $2 AND "supersededAt" IS NULL`,
    [paymentId, input.organizationId]
  );
  await projectWaterSettlement(client, sale);
  const replacement = replacing ? await recordWaterCollection(client, {
    ...input, source: "MANUAL", amountCents: input.amountCents,
    providerReference: input.providerReference, method: input.method,
    paidAt: input.paidAt, notes: input.notes,
  }) : null;
  await recordCorrection(client, { ...input, reason, originalPaymentId: paymentId,
    replacementPaymentId: replacement?.payment?.id || null,
    previousSalePaymentStatus: sale.paymentStatus,
    correctionType: replacing ? "REPLACED" : "REVERSED" });
  return { originalPaymentId: paymentId, replacementPaymentId: replacement?.payment?.id || null };
};

// Older imported "paid" flags have no collection proof. An owner may explicitly
// confirm actual money received or reset the status without inventing a receipt.
export const reconcileLegacyWaterPayment = async (client, input) => {
  const reason = requireReason(input.reason);
  const sale = await lockSale(client, input);
  const history = await loadWaterAppliedCollections(client, input.organizationId, input.saleId);
  const current = deriveWaterSettlement(sale, history);
  if (!current.legacyPaymentCompatibility || history.applicationCount !== 0) {
    throw waterSettlementError("This order does not have an unreconciled legacy paid flag.", "WATER_LEGACY_RECONCILIATION_NOT_NEEDED");
  }
  if (!["confirm", "unpaid"].includes(input.mode)) {
    throw waterSettlementError("Choose confirm received or mark unpaid.", "WATER_CORRECTION_MODE_INVALID", 400);
  }
  await client.query(
    `UPDATE "waterSale" SET "paymentStatus" = 'unpaid', "paidAt" = NULL,
      "updatedAt" = NOW() WHERE "organizationId" = $1 AND id = $2 AND "productKey" = $3`,
    [input.organizationId, input.saleId, input.productKey]
  );
  const confirmed = input.mode === "confirm"
    ? await recordWaterCollection(client, { ...input, source: "MANUAL",
      amountCents: input.amountCents, providerReference: input.providerReference,
      method: input.method, paidAt: input.paidAt, notes: input.notes })
    : null;
  await recordCorrection(client, { ...input, reason,
    replacementPaymentId: confirmed?.payment?.id || null,
    previousSalePaymentStatus: sale.paymentStatus,
    correctionType: confirmed ? "LEGACY_CONFIRMED" : "LEGACY_UNPAID" });
  return { replacementPaymentId: confirmed?.payment?.id || null };
};
