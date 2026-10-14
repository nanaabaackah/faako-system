import { deriveWaterSettlement } from "../../../shared/waterSettlement.js";
import { writeAuditLog } from "../../functions/_shared/auditLog.js";
import { loadWaterAppliedCollections, projectWaterSettlement, waterSettlementError } from "./settlement.js";

// Only explicit manual Water overpayments are spendable. Reversed or mixed-scope
// records fail closed pending reconciliation, rather than minting new credit.
export const loadWaterCustomerCredit = async (client, organizationId, customerId) => {
  const result = await client.query(`
    SELECT pr.id, pr.reference, pr."paidAt", pr."amountCents" - SUM(pa."amountCents") AS "availableCents"
    FROM "paymentRecord" pr
    JOIN "paymentApplication" pa ON pa."paymentId" = pr.id AND pa."organizationId" = pr."organizationId"
    WHERE pr."organizationId" = $1 AND pr."customerId" = $2
      AND pr."businessUnit" = 'WATER' AND pr.currency = 'GHS' AND pr.status = 'PAID'
      AND pr.provider = 'MANUAL_WATER' AND pr.source = 'MANUAL'
    GROUP BY pr.id
    HAVING BOOL_AND(pa.status = 'APPLIED' AND pa."businessUnit" = 'WATER'
      AND pa."payableType" = 'WATER_ORDER' AND pa.currency = 'GHS'
      AND pa."customerId" IS NOT DISTINCT FROM pr."customerId")
      AND pr."amountCents" > SUM(pa."amountCents")
    ORDER BY pr."paidAt", pr.id`, [organizationId, customerId]);
  const credits = result.rows.map((row) => ({ ...row, availableCents: Number(row.availableCents) }));
  return { availableCents: credits.reduce((sum, row) => sum + row.availableCents, 0), credits };
};

// Must run inside runWaterCommand: its durable fingerprint protects retries and
// the encompassing transaction commits applications, projection and audit together.
export const applyWaterCustomerCredit = async (client, input) => {
  const { organizationId, saleId, productKey, amountCents } = input;
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100000000) {
    throw waterSettlementError("Enter a positive Water credit amount.", "INVALID_PAYMENT_AMOUNT", 400);
  }
  const result = await client.query(`SELECT * FROM "waterSale"
    WHERE "organizationId" = $1 AND id = $2 AND "productKey" = $3 AND "archivedAt" IS NULL FOR UPDATE`,
  [organizationId, saleId, productKey]);
  const sale = result.rows[0];
  if (!sale) throw waterSettlementError("Water order not found.", "WATER_SALE_NOT_FOUND", 404);
  if (!sale.customerId) throw waterSettlementError("Select an order customer before applying credit.", "WATER_CREDIT_CUSTOMER_REQUIRED", 400);
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`water-credit:${organizationId}:${sale.customerId}`]);
  // Lock source payments before re-reading available amounts. Parallel orders
  // for the same customer cannot spend the same credit; no payment row is changed.
  await client.query(`SELECT id FROM "paymentRecord" WHERE "organizationId" = $1 AND "customerId" = $2
    AND "businessUnit" = 'WATER' AND currency = 'GHS' AND status = 'PAID' ORDER BY id FOR UPDATE`,
  [organizationId, sale.customerId]);
  const settlement = deriveWaterSettlement(sale, await loadWaterAppliedCollections(client, organizationId, saleId));
  if (settlement.legacyPaymentCompatibility) throw waterSettlementError("Reconcile the legacy payment before applying credit.", "WATER_LEGACY_PAYMENT_RECONCILIATION");
  if (amountCents > settlement.balanceDueCents) throw waterSettlementError("Credit exceeds the order balance.", "PAYMENT_OVERAPPLICATION");
  const { credits } = await loadWaterCustomerCredit(client, organizationId, sale.customerId);
  const existing = await client.query(`SELECT "paymentId" FROM "paymentApplication"
    WHERE "organizationId" = $1 AND "payableType" = 'WATER_ORDER' AND "payableId" = $2`, [organizationId, saleId]);
  const used = new Set(existing.rows.map((row) => Number(row.paymentId)));
  const eligible = credits.filter((row) => !used.has(Number(row.id)));
  if (amountCents > eligible.reduce((sum, row) => sum + row.availableCents, 0)) {
    throw waterSettlementError("Not enough unused Water credit is available for this order. Refresh the customer balance.", "WATER_CREDIT_UNAVAILABLE");
  }
  if (amountCents !== Math.min(settlement.balanceDueCents, eligible.reduce((sum, row) => sum + row.availableCents, 0))) {
    throw waterSettlementError("Apply the available credit up to the order balance. Refresh before trying again.", "WATER_CREDIT_AMOUNT_CHANGED");
  }
  let remaining = amountCents;
  for (const credit of eligible) {
    if (!remaining) break;
    const applied = Math.min(remaining, credit.availableCents);
    await client.query(`INSERT INTO "paymentApplication"
      ("organizationId", "customerId", "paymentId", "businessUnit", "payableType", "payableId", "amountCents", currency, status, "appliedAt", "createdAt")
      VALUES ($1,$2,$3,'WATER','WATER_ORDER',$4,$5,'GHS','APPLIED',NOW(),NOW())`,
    [organizationId, sale.customerId, credit.id, saleId, applied]);
    remaining -= applied;
  }
  const projection = await projectWaterSettlement(client, sale);
  await writeAuditLog(client, { organizationId, userId: input.actor?.userId || null,
    action: "WATER_CUSTOMER_CREDIT_APPLIED", targetType: "waterSale", targetId: String(saleId),
    category: "finance", status: "ok", requestId: input.requestId,
    summary: "Existing customer credit applied to Water order.",
    metadata: { businessUnit: "WATER", productKey, customerId: sale.customerId, amountCents } });
  return projection;
};
