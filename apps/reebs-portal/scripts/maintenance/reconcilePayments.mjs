#!/usr/bin/env node

import { Client } from "pg";

const requestedEnvironment = String(process.argv[2] || "development").trim().toLowerCase();
if (!new Set(["development", "staging", "production"]).has(requestedEnvironment)) {
  console.error("Usage: node scripts/maintenance/reconcilePayments.mjs <development|staging|production>");
  process.exit(2);
}
if (
  requestedEnvironment === "production"
  && process.env.REEBS_ALLOW_PRODUCTION_READINESS_CHECK !== "true"
) {
  console.error("Production payment reconciliation blocked. Set REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true for this read-only command.");
  process.exit(1);
}

process.env.APP_ENV = requestedEnvironment;
const { DATABASE_URL, resolvePgSslConfig } = await import("../../runtimeEnv.js");
if (!DATABASE_URL) {
  console.error(`REEBS ${requestedEnvironment} payment reconciliation blocked: database configuration is missing.`);
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
  connectionTimeoutMillis: 5_000,
  statement_timeout: 20_000,
  application_name: `reebs-${requestedEnvironment}-payment-reconciliation`,
});

const count = (result) => Number(result.rows?.[0]?.count || 0);

try {
  await client.connect();
  await client.query("BEGIN READ ONLY");

  const foundationResult = await client.query(
    `SELECT to_regclass('public."paymentAttempt"') IS NOT NULL
       AND to_regclass('public."paymentRecord"') IS NOT NULL
       AND to_regclass('public."paymentApplication"') IS NOT NULL AS available`
  );
  const paymentFoundationAvailable = Boolean(foundationResult.rows?.[0]?.available);

  const checks = [];
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "orderPayment" p
       LEFT JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId"
       LEFT JOIN "customer" c ON c.id = p."customerId" AND c."organizationId" = p."organizationId"
       WHERE o.id IS NULL OR c.id IS NULL`
    ));
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT "organizationId", LOWER(TRIM("transactionReference")),
                CASE
                  WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
                    IN ('momo', 'mobile_money', 'mobilemoney') THEN 'mobile_money'
                  WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
                    IN ('bank', 'bank_transfer', 'transfer') THEN 'bank_transfer'
                  WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
                    IN ('card', 'credit_card', 'debit_card') THEN 'card'
                  ELSE REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
                END AS normalized_method
         FROM "orderPayment"
         WHERE NULLIF(TRIM("transactionReference"), '') IS NOT NULL
         GROUP BY "organizationId", LOWER(TRIM("transactionReference")), normalized_method
         HAVING COUNT(*) > 1
       ) duplicates`
    ));
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "orderPayment" p
       JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId"
       WHERE p."customerId" <> o."customerId"`
    ));
  checks.push(await client.query(
      `WITH paid AS (
         SELECT "organizationId", "orderId",
                COALESCE(SUM("amountCents") FILTER (
                  WHERE LOWER(COALESCE(status, 'successful')) IN ('successful','confirmed','paid')
                ), 0)::int AS paid_cents
         FROM "orderPayment"
         GROUP BY "organizationId", "orderId"
       )
       SELECT COUNT(*)::int AS count
       FROM "order" o
       LEFT JOIN paid p ON p."organizationId" = o."organizationId" AND p."orderId" = o.id
       WHERE COALESCE(o."amountPaidCents", 0) <> COALESCE(p.paid_cents, 0)
          OR COALESCE(o."balanceDueCents", GREATEST(COALESCE(o."grandTotalCents", o.total_amount) - COALESCE(o."amountPaidCents", 0), 0))
             <> GREATEST(COALESCE(o."grandTotalCents", o.total_amount) - COALESCE(p.paid_cents, 0), 0)
          OR (LOWER(COALESCE(o."paymentStatus", 'unpaid')) = 'paid'
              AND COALESCE(p.paid_cents, 0) < COALESCE(o."grandTotalCents", o.total_amount))`
    ));
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "orderPayment" p
       JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId"
       WHERE COALESCE(o."businessUnit", 'REEBS_CORE') <> 'REEBS_CORE'`
    ));
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "orderPayment" p
       LEFT JOIN "orderReceipt" r
         ON r."organizationId" = p."organizationId" AND r."paymentId" = p.id
       WHERE LOWER(COALESCE(p.status, 'successful')) IN ('successful','confirmed','paid')
         AND r.id IS NULL`
    ));
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "orderPayment"
       WHERE REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
         IN ('momo','mobile_money','mobilemoney','bank','bank_transfer','transfer','card','credit_card','debit_card')
         AND NULLIF(TRIM("transactionReference"), '') IS NULL`
    ));
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT "organizationId", LOWER(TRIM("providerReference"))
         FROM "waterSale"
         WHERE NULLIF(TRIM("providerReference"), '') IS NOT NULL
         GROUP BY "organizationId", LOWER(TRIM("providerReference"))
         HAVING COUNT(*) > 1
       ) duplicates`
    ));
  checks.push(await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "waterSale"
       WHERE NULLIF(TRIM("paymentReference"), '') IS NULL`
    ));
  const [orphanPayments, duplicateReferences, applicationMismatch, balanceMismatch, scopeMismatch, missingReceipts, missingManualReferences, waterDuplicateReferences, waterMissingReferences] = checks;

  const balanceMismatchDetails = count(balanceMismatch) > 0
    ? await client.query(
      `WITH paid AS (
         SELECT "organizationId", "orderId",
                COALESCE(SUM("amountCents") FILTER (
                  WHERE LOWER(COALESCE(status, 'successful')) IN ('successful','confirmed','paid')
                ), 0)::int AS paid_cents
         FROM "orderPayment"
         GROUP BY "organizationId", "orderId"
       )
       SELECT o."orderNumber", o.status, o."paymentStatus",
              COALESCE(o."grandTotalCents", o.total_amount)::int AS "totalCents",
              COALESCE(o."amountPaidCents", 0)::int AS "storedPaidCents",
              COALESCE(p.paid_cents, 0)::int AS "ledgerPaidCents",
              COALESCE(o."balanceDueCents", 0)::int AS "storedBalanceCents",
              GREATEST(COALESCE(o."grandTotalCents", o.total_amount) - COALESCE(p.paid_cents, 0), 0)::int AS "ledgerBalanceCents"
       FROM "order" o
       LEFT JOIN paid p ON p."organizationId" = o."organizationId" AND p."orderId" = o.id
       WHERE COALESCE(o."amountPaidCents", 0) <> COALESCE(p.paid_cents, 0)
          OR COALESCE(o."balanceDueCents", GREATEST(COALESCE(o."grandTotalCents", o.total_amount) - COALESCE(o."amountPaidCents", 0), 0))
             <> GREATEST(COALESCE(o."grandTotalCents", o.total_amount) - COALESCE(p.paid_cents, 0), 0)
          OR (LOWER(COALESCE(o."paymentStatus", 'unpaid')) = 'paid'
              AND COALESCE(p.paid_cents, 0) < COALESCE(o."grandTotalCents", o.total_amount))
       ORDER BY o."orderDate" ASC, o.id ASC
       LIMIT 20`
    )
    : { rows: [] };

  let foundationChecks = {
    paidAttemptWithoutPayment: null,
    paymentWithoutApplication: null,
    applicationIntegrityMismatch: null,
    waterScopeMismatch: null,
  };
  if (paymentFoundationAvailable) {
    const [paidAttemptWithoutPayment, paymentWithoutApplication, applicationIntegrityMismatch, waterScopeMismatch] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "paymentAttempt" a
         LEFT JOIN "paymentRecord" p ON p."attemptId" = a.id
         WHERE a.status = 'PAID' AND p.id IS NULL`
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "paymentRecord" p
         LEFT JOIN "paymentApplication" a ON a."paymentId" = p.id AND a."organizationId" = p."organizationId"
         WHERE p.status = 'PAID' AND a.id IS NULL`
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "paymentRecord" p
         JOIN "paymentApplication" a ON a."paymentId" = p.id AND a."organizationId" = p."organizationId"
         WHERE p."businessUnit" <> a."businessUnit"
            OR p.currency <> a.currency
            OR p."amountCents" <> a."amountCents"
            OR p."customerId" IS DISTINCT FROM a."customerId"`
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "paymentApplication"
         WHERE ("payableType" = 'WATER_ORDER' AND "businessUnit" <> 'WATER')
            OR ("payableType" <> 'WATER_ORDER' AND "businessUnit" = 'WATER')`
      ),
    ]);
    foundationChecks = {
      paidAttemptWithoutPayment: count(paidAttemptWithoutPayment),
      paymentWithoutApplication: count(paymentWithoutApplication),
      applicationIntegrityMismatch: count(applicationIntegrityMismatch),
      waterScopeMismatch: count(waterScopeMismatch),
    };
  }

  const matrix = [
    { check: "Orphan Core payments", records: count(orphanPayments), severity: "critical", action: "Review parent/customer relationships; do not auto-fix." },
    { check: "Duplicate Core external references", records: count(duplicateReferences), severity: "high", action: "Confirm genuine duplicates before any correction." },
    { check: "Core payment/customer mismatch", records: count(applicationMismatch), severity: "critical", action: "Review payment application and audit history." },
    { check: "Core paid/balance/status mismatch", records: count(balanceMismatch), severity: "critical", action: "Recalculate from successful ledger records after human review." },
    { check: "Core payment scope mismatch", records: count(scopeMismatch), severity: "critical", action: "Investigate business-unit relationship; never merge with Water." },
    { check: "Successful Core payment missing receipt", records: count(missingReceipts), severity: "high", action: "Review transaction and generate only through an approved repair." },
    { check: "Manual electronic payment missing reference", records: count(missingManualReferences), severity: "medium", action: "Reconcile against bank/MoMo records; preserve history." },
    { check: "Duplicate Water provider references", records: count(waterDuplicateReferences), severity: "high", action: "Review inside Water only." },
    { check: "Water sale missing Water reference", records: count(waterMissingReferences), severity: "medium", action: "Backfill only through the existing Water maintenance path." },
    { check: "Paid attempt missing Payment record", records: foundationChecks.paidAttemptWithoutPayment, severity: paymentFoundationAvailable ? "critical" : "not_measured", action: paymentFoundationAvailable ? "Investigate atomic finalization failure." : "Run migration 20260903120000_payments_foundation in the target deployment workflow first." },
    { check: "Paid Payment missing application", records: foundationChecks.paymentWithoutApplication, severity: paymentFoundationAvailable ? "critical" : "not_measured", action: "Review the payment/application transaction; never assign it from the UI." },
    { check: "Payment/application integrity mismatch", records: foundationChecks.applicationIntegrityMismatch, severity: paymentFoundationAvailable ? "critical" : "not_measured", action: "Review scope, customer, currency, and amount against the trusted payable." },
    { check: "Universal Water/Core scope mismatch", records: foundationChecks.waterScopeMismatch, severity: paymentFoundationAvailable ? "critical" : "not_measured", action: "Correct only through an approved reconciliation workflow; do not merge Water into Core." },
    { check: "Refund mismatch", records: null, severity: "not_measured", action: "Refund records are not implemented; no status-only refund should be used." },
    { check: "Provider/local mismatch", records: null, severity: "not_measured", action: "Requires configured Paystack test/production reconciliation; no live lookup was made." },
  ];

  console.log(JSON.stringify({
    environment: requestedEnvironment,
    readOnly: true,
    paymentFoundationAvailable,
    businessScope: {
      core: "orderPayment joined only to REEBS_CORE orders",
      water: "waterSale checked separately and never aggregated into Core",
    },
    matrix,
    humanReview: {
      coreBalanceMismatches: balanceMismatchDetails.rows,
    },
  }, null, 2));
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`REEBS ${requestedEnvironment} payment reconciliation failed safely: ${error.code || "query_error"}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
