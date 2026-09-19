#!/usr/bin/env node

import { Client } from "pg";

const requestedEnvironment = String(process.argv[2] || "development").trim().toLowerCase();
if (!new Set(["development", "staging", "production"]).has(requestedEnvironment)) {
  console.error("Usage: node scripts/maintenance/auditOrderConsistency.mjs <development|staging|production>");
  process.exit(2);
}
if (
  requestedEnvironment === "production"
  && process.env.REEBS_ALLOW_PRODUCTION_READINESS_CHECK !== "true"
) {
  console.error("Production order audit blocked. Set REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true for this read-only command.");
  process.exit(1);
}

process.env.APP_ENV = requestedEnvironment;
const { DATABASE_URL, resolvePgSslConfig } = await import("../../runtimeEnv.js");
if (!DATABASE_URL) {
  console.error(`REEBS ${requestedEnvironment} order audit blocked: database configuration is missing.`);
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: `reebs-${requestedEnvironment}-order-consistency-audit`,
});

try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const subtotalResult = await client.query(
    `SELECT o.id, o."orderNumber", o.status, o.source, o."orderDate",
            o."subtotalCents" AS "storedSubtotalCents",
            COALESCE(SUM(oi.total_amount), 0)::int AS "lineSubtotalCents",
            (o."subtotalCents" - COALESCE(SUM(oi.total_amount), 0))::int AS "deltaCents",
            COUNT(oi.id)::int AS "lineCount"
     FROM "order" o
     LEFT JOIN "orderItem" oi
       ON oi."organizationId" = o."organizationId"
      AND oi."orderId" = o.id
     WHERE o."subtotalCents" IS NOT NULL
     GROUP BY o.id
     HAVING o."subtotalCents" <> COALESCE(SUM(oi.total_amount), 0)
     ORDER BY o."orderDate" ASC, o.id ASC`
  );
  const balanceResult = await client.query(
    `SELECT id, "orderNumber", status, "paymentStatus", "grandTotalCents",
            "amountPaidCents", "balanceDueCents",
            GREATEST(COALESCE("grandTotalCents", total_amount) - COALESCE("amountPaidCents", 0), 0)::int
              AS "calculatedBalanceCents"
     FROM "order"
     WHERE "balanceDueCents" IS NOT NULL
       AND "balanceDueCents" <> GREATEST(COALESCE("grandTotalCents", total_amount) - COALESCE("amountPaidCents", 0), 0)
     ORDER BY "orderDate" ASC, id ASC`
  );
  const boundaryResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM "orderItem" oi
     JOIN "waterProductConfig" wpc
       ON wpc."organizationId" = oi."organizationId"
      AND wpc."inventoryProductId" = oi."productId"
      AND wpc."isActive" = TRUE`
  );
  const invalidLineResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM "orderItem"
     WHERE quantity <= 0 OR unit_price <= 0 OR total_amount <= 0`
  );
  console.log(JSON.stringify({
    environment: requestedEnvironment,
    readOnly: true,
    subtotalDiscrepancies: subtotalResult.rows,
    balanceDiscrepancies: balanceResult.rows,
    waterProductsInCoreOrders: Number(boundaryResult.rows[0]?.count || 0),
    invalidOrderLines: Number(invalidLineResult.rows[0]?.count || 0),
  }, null, 2));
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`REEBS ${requestedEnvironment} order audit failed safely: ${error.code || "query_error"}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
