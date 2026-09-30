#!/usr/bin/env node

import { Client } from "pg";

const requestedEnvironment = String(process.argv[2] || "development").trim().toLowerCase();
if (!["development", "staging", "production"].includes(requestedEnvironment)) {
  console.error("Usage: node scripts/checkDataConsistency.mjs <development|staging|production>");
  process.exit(2);
}

process.env.APP_ENV = requestedEnvironment;
const { DATABASE_URL, resolvePgSslConfig } = await import("../runtimeEnv.js");

if (!DATABASE_URL) {
  console.error(`REEBS ${requestedEnvironment} data check blocked: database configuration is missing.`);
  process.exit(1);
}
if (requestedEnvironment === "production" && process.env.REEBS_ALLOW_PRODUCTION_READINESS_CHECK !== "true") {
  console.error("REEBS production data check blocked. Set REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true for this read-only command.");
  process.exit(1);
}

const checks = [
  ["orders_without_valid_totals", `SELECT COUNT(*)::int AS count FROM "order" WHERE "total_amount" IS NULL OR "total_amount" < 0`],
  ["payments_without_parent_order", `SELECT COUNT(*)::int AS count FROM "orderPayment" p LEFT JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId" WHERE o.id IS NULL`],
  ["negative_product_inventory", `SELECT COUNT(*)::int AS count FROM "product" WHERE "isDeleted" = false AND stock < 0`],
  ["negative_variant_inventory", `SELECT COUNT(*)::int AS count FROM "inventoryVariant" WHERE "status" = 'active' AND "stockQty" < 0`],
  ["water_sales_without_product_scope", `SELECT COUNT(*)::int AS count FROM "waterSale" s LEFT JOIN "waterProductConfig" c ON c."organizationId" = s."organizationId" AND c."productKey" = s."productKey" WHERE c.id IS NULL`],
  ["water_products_missing_commercial_config", `SELECT COUNT(*)::int AS count FROM "waterProductConfig" WHERE "isActive" = true AND (COALESCE("retailSinglePrice", 0) <= 0 OR COALESCE("costPrice", 0) <= 0)`],
  ["organizations_missing_water_commercial_config", `SELECT COUNT(*)::int AS count FROM "organization" o WHERE NOT EXISTS (SELECT 1 FROM "waterProductConfig" c WHERE c."organizationId" = o.id AND c."isActive" = true AND COALESCE(c."retailSinglePrice", 0) > 0 AND COALESCE(c."costPrice", 0) > 0)`],
  ["reebs_products_missing_selling_price", `SELECT COUNT(*)::int AS count FROM "product" WHERE "isActive" = true AND "isDeleted" = false AND "isArchived" = false AND price <= 0`],
  ["order_subtotal_discrepancies", `SELECT COUNT(*)::int AS count FROM "order" o WHERE o."subtotalCents" IS NOT NULL AND o."subtotalCents" <> COALESCE((SELECT SUM(i."total_amount") FROM "orderItem" i WHERE i."orderId" = o.id), 0)`],
  ["order_balance_discrepancies", `SELECT COUNT(*)::int AS count FROM "order" WHERE "balanceDueCents" IS NOT NULL AND "balanceDueCents" <> GREATEST(COALESCE("grandTotalCents", "total_amount") - COALESCE("amountPaidCents", 0), 0)`],
  ["water_transaction_snapshot_discrepancies", `SELECT COUNT(*)::int AS count FROM "waterSale" WHERE "totalAmount" <> GREATEST(("unitPrice" * quantity) - COALESCE("discountAmount", 0), 0)`],
  ["bookings_without_customer", `SELECT COUNT(*)::int AS count FROM "booking" b LEFT JOIN "customer" c ON c.id = b."customerId" AND c."organizationId" = b."organizationId" WHERE c.id IS NULL`],
  ["booking_invalid_date_ranges", `SELECT COUNT(*)::int AS count FROM "booking" WHERE "eventEndDate"::date < "eventDate"::date`],
  ["booking_lines_without_product", `SELECT COUNT(*)::int AS count FROM "bookingItem" bi LEFT JOIN "product" p ON p.id = bi."productId" AND p."organizationId" = bi."organizationId" WHERE p.id IS NULL`],
  ["booking_invalid_line_quantities", `SELECT COUNT(*)::int AS count FROM "bookingItem" WHERE quantity <= 0`],
  ["booking_line_total_discrepancies", `SELECT COUNT(*)::int AS count FROM "bookingItem" WHERE "lineTotal" <> price * quantity`],
  ["booking_total_discrepancies", `SELECT COUNT(*)::int AS count FROM "booking" WHERE "totalAmount" <> GREATEST("subtotalCents" + "feeCents" + "taxCents" - "discountCents", 0)`],
  ["booking_variant_reservation_discrepancies", `SELECT COUNT(*)::int AS count FROM "inventoryVariant" v WHERE COALESCE(v."reservedQty", 0) <> COALESCE((SELECT SUM(bi.quantity) FROM "bookingItem" bi JOIN "booking" b ON b.id = bi."bookingId" AND b."organizationId" = bi."organizationId" WHERE bi."variantId" = v.id AND bi."organizationId" = v."organizationId" AND LOWER(b.status) IN ('pending', 'confirmed')), 0)`],
];

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: `reebs-${requestedEnvironment}-readiness-check`,
});

let issueCount = 0;
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  for (const [name, sql] of checks) {
    const result = await client.query(sql);
    const count = Number(result.rows[0]?.count || 0);
    console.log(`${count === 0 ? "PASS" : "BLOCK"} ${name}: ${count}`);
    issueCount += count;
  }
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`REEBS ${requestedEnvironment} data check failed safely: ${error.code || "query_error"}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

if (issueCount > 0) {
  console.error(`REEBS data consistency check found ${issueCount} blocking record discrepancies. No data was changed.`);
  process.exitCode = 1;
} else if (!process.exitCode) {
  console.log(`REEBS ${requestedEnvironment} data consistency check passed. No data was changed.`);
}
