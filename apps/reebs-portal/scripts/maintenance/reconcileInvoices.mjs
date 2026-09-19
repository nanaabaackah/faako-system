#!/usr/bin/env node

import { Client } from "pg";

const environment = String(process.argv[2] || "development").trim().toLowerCase();
if (!new Set(["development", "staging", "production"]).has(environment)) {
  console.error("Usage: node scripts/maintenance/reconcileInvoices.mjs <development|staging|production>");
  process.exit(2);
}
if (environment === "production" && process.env.REEBS_ALLOW_PRODUCTION_READINESS_CHECK !== "true") {
  console.error("Production invoice reconciliation blocked. Set REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true for this read-only command.");
  process.exit(1);
}

process.env.APP_ENV = environment;
const { DATABASE_URL, resolvePgSslConfig } = await import("../../runtimeEnv.js");
if (!DATABASE_URL) {
  console.error(`REEBS ${environment} invoice reconciliation blocked: database configuration is missing.`);
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
  connectionTimeoutMillis: 5_000,
  statement_timeout: 20_000,
  application_name: `reebs-${environment}-invoice-reconciliation`,
});
const count = (result) => Number(result.rows?.[0]?.count || 0);

try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const foundation = await client.query(
    `SELECT to_regclass('public."invoiceDocument"') IS NOT NULL AS invoices,
            to_regclass('public."invoiceNumberSequence"') IS NOT NULL AS sequences,
            to_regclass('public."paymentApplication"') IS NOT NULL AS payments,
            EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'invoiceDocument' AND column_name = 'financialSnapshot'
            ) AS snapshots`
  );
  const available = foundation.rows?.[0] || {};
  if (!available.invoices) {
    console.log(JSON.stringify({
      environment,
      readOnly: true,
      migrationRequired: "20260904120000_invoicing_integrity",
      status: "NOT_MEASURED",
      reason: "The invoice document table does not exist in this environment.",
    }, null, 2));
    await client.query("ROLLBACK");
    process.exit(0);
  }
  if (!available.snapshots) {
    const duplicateNumbers = await client.query(
      `SELECT COUNT(*)::int AS count FROM (
         SELECT "organizationId", "invoiceNumber" FROM "invoiceDocument"
         WHERE NULLIF(TRIM("invoiceNumber"), '') IS NOT NULL
         GROUP BY "organizationId", "invoiceNumber" HAVING COUNT(*) > 1
       ) duplicate_numbers`
    );
    console.log(JSON.stringify({
      environment,
      readOnly: true,
      migrationRequired: "20260904120000_invoicing_integrity",
      status: "PRE_MIGRATION",
      repairPerformed: false,
      matrix: [{ check: "Duplicate invoice numbers", records: count(duplicateNumbers), severity: "critical" }],
      deferredChecks: "Snapshot, lifecycle, scope and payment checks require the additive migration.",
    }, null, 2));
    await client.query("ROLLBACK");
    process.exit(0);
  }

  const checks = [];
  checks.push(await client.query(
    `SELECT COUNT(*)::int AS count FROM (
       SELECT "organizationId", "invoiceNumber" FROM "invoiceDocument"
       WHERE NULLIF(TRIM("invoiceNumber"), '') IS NOT NULL
       GROUP BY "organizationId", "invoiceNumber" HAVING COUNT(*) > 1
     ) duplicate_numbers`
  ));
  checks.push(await client.query(
    `SELECT COUNT(*)::int AS count FROM "invoiceDocument"
     WHERE "issuedAt" IS NOT NULL AND ("customerSnapshot" IS NULL OR "sourceSnapshot" IS NULL OR "financialSnapshot" IS NULL)`
  ));
  checks.push(await client.query(
    `SELECT COUNT(*)::int AS count FROM "invoiceDocument"
     WHERE "businessUnit" <> 'REEBS_CORE' OR "sourceType" NOT IN ('manual','orders','bookings')`
  ));
  checks.push(await client.query(
    `SELECT COUNT(*)::int AS count FROM "invoiceDocument"
     WHERE "issuedAt" IS NOT NULL AND COALESCE(("financialSnapshot"->>'totalCents')::bigint, 0) <= 0`
  ));
  checks.push(await client.query(
    `SELECT COUNT(*)::int AS count FROM "invoiceDocument"
     WHERE "voidedAt" IS NOT NULL AND LOWER(COALESCE("paymentStatus", '')) <> 'void'`
  ));
  checks.push(await client.query(
    `SELECT COUNT(*)::int AS count FROM "invoiceDocument"
     WHERE "issuedAt" IS NULL AND ("sentAt" IS NOT NULL OR LOWER(COALESCE("paymentStatus", 'draft')) <> 'draft')`
  ));
  let paymentMismatch = null;
  let orphanApplication = null;
  if (available.payments) {
    paymentMismatch = await client.query(
      `WITH applied AS (
         SELECT "organizationId", "payableId",
                COALESCE(SUM("amountCents") FILTER (WHERE status = 'APPLIED'), 0)::bigint AS paid
         FROM "paymentApplication" WHERE "payableType" = 'INVOICE'
         GROUP BY "organizationId", "payableId"
       )
       SELECT COUNT(*)::int AS count FROM "invoiceDocument" i
       LEFT JOIN applied a ON a."organizationId" = i."organizationId" AND a."payableId" = i.id
       WHERE i."paymentStateVersion" >= 1 AND i."voidedAt" IS NULL AND (
         (LOWER(i."paymentStatus") = 'paid' AND COALESCE(a.paid, 0) < COALESCE((i."financialSnapshot"->>'totalCents')::bigint, 0)) OR
         (LOWER(i."paymentStatus") IN ('unpaid','overdue') AND COALESCE(a.paid, 0) > 0) OR
         (LOWER(i."paymentStatus") = 'partially_paid' AND (COALESCE(a.paid, 0) <= 0 OR COALESCE(a.paid, 0) >= COALESCE((i."financialSnapshot"->>'totalCents')::bigint, 0)))
       )`
    );
    orphanApplication = await client.query(
      `SELECT COUNT(*)::int AS count FROM "paymentApplication" a
       LEFT JOIN "invoiceDocument" i
         ON i.id = a."payableId" AND i."organizationId" = a."organizationId"
       WHERE a."payableType" = 'INVOICE' AND (i.id IS NULL OR a."businessUnit" <> 'REEBS_CORE')`
    );
  }

  const [duplicateNumbers, missingSnapshots, scopeMismatch, invalidTotals, voidMismatch, lifecycleMismatch] = checks;
  const matrix = [
    { check: "Duplicate invoice numbers", records: count(duplicateNumbers), severity: "critical" },
    { check: "Issued invoice missing immutable snapshot", records: count(missingSnapshots), severity: "critical" },
    { check: "Core/Water or source-scope mismatch", records: count(scopeMismatch), severity: "critical" },
    { check: "Issued invoice with non-positive total", records: count(invalidTotals), severity: "high" },
    { check: "Void lifecycle mismatch", records: count(voidMismatch), severity: "high" },
    { check: "Legacy lifecycle mismatch", records: count(lifecycleMismatch), severity: "high" },
    { check: "Payment-derived status mismatch", records: paymentMismatch ? count(paymentMismatch) : null, severity: available.payments ? "critical" : "not_measured" },
    { check: "Orphan/cross-scope invoice payment application", records: orphanApplication ? count(orphanApplication) : null, severity: available.payments ? "critical" : "not_measured" },
  ];
  console.log(JSON.stringify({
    environment,
    readOnly: true,
    foundations: available,
    businessScope: "REEBS_CORE only; Water is reported as a mismatch and is never aggregated.",
    repairPerformed: false,
    matrix,
  }, null, 2));
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`REEBS ${environment} invoice reconciliation failed safely: ${error.code || "query_error"}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
