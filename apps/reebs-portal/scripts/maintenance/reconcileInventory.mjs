#!/usr/bin/env node

import { Client } from "pg";

const requestedEnvironment = String(process.argv[2] || "development").trim().toLowerCase();
if (!new Set(["development", "staging", "production"]).has(requestedEnvironment)) {
  console.error("Usage: node scripts/maintenance/reconcileInventory.mjs <development|staging|production>");
  process.exit(2);
}
if (
  requestedEnvironment === "production"
  && process.env.REEBS_ALLOW_PRODUCTION_READINESS_CHECK !== "true"
) {
  console.error("Production Inventory reconciliation blocked. Set REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true for this read-only command.");
  process.exit(1);
}

process.env.APP_ENV = requestedEnvironment;
const { DATABASE_URL, resolvePgSslConfig } = await import("../../runtimeEnv.js");
if (!DATABASE_URL) {
  console.error(`REEBS ${requestedEnvironment} Inventory reconciliation blocked: database configuration is missing.`);
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
  connectionTimeoutMillis: 5_000,
  statement_timeout: 20_000,
  application_name: `reebs-${requestedEnvironment}-inventory-reconciliation`,
});

const run = async (sql, params = []) => (await client.query(sql, params)).rows;
const runSequentially = async (operations) => {
  const results = [];
  for (const operation of operations) results.push(await operation());
  return results;
};

let blockingIssueCount = 0;
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");

  const [
    negativeProducts,
    invalidVariants,
    variantParentDrift,
    reservationDrift,
    maintenanceAvailabilityDrift,
    orphanMovements,
    waterBoundary,
    ledgerGaps,
  ] = await runSequentially([
    () => run(`SELECT "organizationId", id, sku, name, stock
         FROM "product"
         WHERE COALESCE("isDeleted", false) = false AND stock < 0
         ORDER BY "organizationId", id`),
    () => run(`SELECT "organizationId", id, "inventoryItemId", sku, "stockQty", "reservedQty"
         FROM "inventoryVariant"
         WHERE "stockQty" < 0 OR "reservedQty" < 0
         ORDER BY "organizationId", id`),
    () => run(`SELECT p."organizationId", p.id, p.sku, p.name, p.stock AS "storedStock",
                COALESCE(SUM(v."stockQty") FILTER (
                  WHERE LOWER(COALESCE(v.status, 'active')) <> 'inactive'
                ), 0)::int AS "variantStock"
         FROM "product" p
         LEFT JOIN "inventoryVariant" v
           ON v."organizationId" = p."organizationId"
          AND v."inventoryItemId" = p.id
         WHERE UPPER(COALESCE(p."itemType", 'STANDARD')) = 'VARIANT_PARENT'
           AND COALESCE(p."isDeleted", false) = false
         GROUP BY p."organizationId", p.id
         HAVING p.stock <> COALESCE(SUM(v."stockQty") FILTER (
           WHERE LOWER(COALESCE(v.status, 'active')) <> 'inactive'
         ), 0)::int
         ORDER BY p."organizationId", p.id`),
    () => run(`SELECT v."organizationId", v.id, v.sku, v."reservedQty" AS "storedReserved",
                COALESCE(SUM(bi.quantity), 0)::int AS "activeBookingReserved"
         FROM "inventoryVariant" v
         LEFT JOIN "bookingItem" bi
           ON bi."organizationId" = v."organizationId"
          AND bi."variantId" = v.id
         LEFT JOIN "booking" b
           ON b."organizationId" = bi."organizationId"
          AND b.id = bi."bookingId"
          AND LOWER(COALESCE(b.status, '')) IN ('pending', 'confirmed')
         GROUP BY v."organizationId", v.id
         HAVING v."reservedQty" <> COALESCE(SUM(bi.quantity) FILTER (WHERE b.id IS NOT NULL), 0)::int
         ORDER BY v."organizationId", v.id`),
    () => run(`SELECT p."organizationId", p.id, p.sku, p.name, p."isActive",
                COUNT(m.id) FILTER (
                  WHERE m."resolvedAt" IS NULL
                    AND LOWER(COALESCE(m.status, 'open')) = 'open'
                )::int AS "openMaintenance"
         FROM "product" p
         LEFT JOIN "maintenanceLog" m
           ON m."organizationId" = p."organizationId"
          AND m."productId" = p.id
         WHERE COALESCE(p."isDeleted", false) = false
           AND COALESCE(p."isArchived", false) = false
         GROUP BY p."organizationId", p.id
         HAVING (
           COUNT(m.id) FILTER (
             WHERE m."resolvedAt" IS NULL
               AND LOWER(COALESCE(m.status, 'open')) = 'open'
           ) > 0 AND p."isActive" = true
         )
         ORDER BY p."organizationId", p.id`),
    () => run(`SELECT sm."organizationId", sm.id, sm."productId", sm."variantId", sm.type, sm.quantity
         FROM "stockMovement" sm
         LEFT JOIN "product" p
           ON p."organizationId" = sm."organizationId" AND p.id = sm."productId"
         LEFT JOIN "inventoryVariant" v
           ON v."organizationId" = sm."organizationId" AND v.id = sm."variantId"
         WHERE p.id IS NULL OR (sm."variantId" IS NOT NULL AND v.id IS NULL)
         ORDER BY sm."organizationId", sm.id`),
    () => run(`SELECT p."organizationId", p.id, p.sku, p.name, wpc."productKey"
         FROM "product" p
         JOIN "waterProductConfig" wpc
           ON wpc."organizationId" = p."organizationId"
          AND wpc."inventoryProductId" = p.id
          AND wpc."isActive" = TRUE
         ORDER BY p."organizationId", p.id`),
    () => run(`WITH signed AS (
           SELECT sm."organizationId", sm."productId",
             SUM(CASE
               WHEN LOWER(sm.type) IN (
                 'stockin', 'return', 'restore', 'shop_return_restock', 'shop_sale_cancelled'
               ) THEN sm.quantity
               WHEN LOWER(sm.type) IN ('stockout', 'shop_sale', 'shop_damaged', 'sale') THEN -sm.quantity
               ELSE 0
             END)::int AS "movementNet",
             MIN(sm.date) AS "firstMovementAt"
           FROM "stockMovement" sm
           WHERE sm."variantId" IS NULL
           GROUP BY sm."organizationId", sm."productId"
         )
         SELECT p."organizationId", p.id, p.sku, p.name, p.stock AS "currentStock",
                signed."movementNet", signed."firstMovementAt",
                (p.stock - signed."movementNet")::int AS "openingBalanceOrGap"
         FROM signed
         JOIN "product" p
           ON p."organizationId" = signed."organizationId"
          AND p.id = signed."productId"
         WHERE p.stock <> signed."movementNet"
           AND NOT EXISTS (
             SELECT 1 FROM "waterProductConfig" wpc
             WHERE wpc."organizationId" = p."organizationId"
               AND wpc."inventoryProductId" = p.id
               AND wpc."isActive" = TRUE
           )
         ORDER BY p."organizationId", p.id`),
  ]);

  const movementColumn = await run(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = ANY(current_schemas(false))
       AND table_name = 'stockMovement'
       AND column_name = 'idempotencyKey'
     LIMIT 1`
  );
  const duplicateIdempotencyKeys = movementColumn.length
    ? await run(`SELECT "organizationId", "idempotencyKey", COUNT(*)::int AS count
                 FROM "stockMovement"
                 WHERE "idempotencyKey" IS NOT NULL
                 GROUP BY "organizationId", "idempotencyKey"
                 HAVING COUNT(*) > 1
                 ORDER BY "organizationId", "idempotencyKey"`)
    : [];

  const blocking = {
    negativeProducts,
    invalidVariants,
    variantParentDrift,
    reservationDrift,
    maintenanceAvailabilityDrift,
    orphanMovements,
    duplicateIdempotencyKeys,
  };
  blockingIssueCount = Object.values(blocking).reduce((sum, rows) => sum + rows.length, 0);

  console.log(JSON.stringify({
    environment: requestedEnvironment,
    readOnly: true,
    invariant: {
      standard: "product.stock is physical on-hand stock and must be non-negative",
      variantParent: "product.stock equals the sum of active variant stockQty",
      variantAvailability: "stockQty - reservedQty is non-negative stock available outside active commitments",
      rentalAvailability: "authoritative availability is date-specific in Bookings; global reservedQty is an operational commitment counter",
      maintenance: "an item with an open maintenance record is unavailable",
      water: "Water ledger stock is independent and excluded from Core Inventory",
    },
    blocking,
    informational: {
      waterLinkedProductsExcludedFromCore: waterBoundary,
      historicalLedgerGaps: ledgerGaps,
      historicalLedgerNote: "A non-zero opening balance or gap can reflect imports that predate movement tracking. No movement was fabricated.",
    },
  }, null, 2));

  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`REEBS ${requestedEnvironment} Inventory reconciliation failed safely: ${error.code || "query_error"}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

if (blockingIssueCount > 0) {
  console.error(`Inventory reconciliation found ${blockingIssueCount} blocking discrepancies. No data was changed.`);
  process.exitCode = 1;
} else if (!process.exitCode) {
  console.log(`REEBS ${requestedEnvironment} Inventory reconciliation passed. No data was changed.`);
}
