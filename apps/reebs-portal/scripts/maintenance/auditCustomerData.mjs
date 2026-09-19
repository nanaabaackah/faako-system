#!/usr/bin/env node

import { Client } from "pg";

const requestedEnvironment = String(process.argv[2] || "development").trim().toLowerCase();
if (!new Set(["development", "staging", "production"]).has(requestedEnvironment)) {
  console.error("Usage: node scripts/maintenance/auditCustomerData.mjs <development|staging|production>");
  process.exit(2);
}
if (requestedEnvironment === "production" && process.env.REEBS_ALLOW_PRODUCTION_READINESS_CHECK !== "true") {
  console.error("Production customer audit blocked. Set REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true for this read-only command.");
  process.exit(1);
}

process.env.APP_ENV = requestedEnvironment;
const { DATABASE_URL, resolvePgSslConfig } = await import("../../runtimeEnv.js");
if (!DATABASE_URL) {
  console.error(`REEBS ${requestedEnvironment} customer audit blocked: database configuration is missing.`);
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: `reebs-${requestedEnvironment}-customer-data-audit`,
});

try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const result = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE "normalizedPhone" IS NOT NULL AND duplicate_phone_count > 1)::int AS "exactPhoneDuplicateRecords",
       COUNT(*) FILTER (WHERE "normalizedEmail" IS NOT NULL AND duplicate_email_count > 1)::int AS "exactEmailDuplicateRecords"
     FROM (
       SELECT c.id, NULLIF(c."normalizedPhone", '') AS "normalizedPhone",
              NULLIF(c."normalizedEmail", '') AS "normalizedEmail",
              COUNT(*) OVER (PARTITION BY c."organizationId", NULLIF(c."normalizedPhone", '')) AS duplicate_phone_count,
              COUNT(*) OVER (PARTITION BY c."organizationId", NULLIF(c."normalizedEmail", '')) AS duplicate_email_count
       FROM "customer" c
       WHERE c."deletedAt" IS NULL
     ) duplicates`
  );
  const qualityResult = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE (phone IS NULL OR BTRIM(phone) = '') AND (email IS NULL OR BTRIM(email) = ''))::int AS "missingContact",
       COUNT(*) FILTER (WHERE phone IS NOT NULL AND BTRIM(phone) <> '' AND "normalizedPhone" IS NULL)::int AS "invalidOrUnnormalizedPhones",
       COUNT(*) FILTER (WHERE email IS NOT NULL AND BTRIM(email) <> '' AND "normalizedEmail" IS NULL)::int AS "invalidOrUnnormalizedEmails",
       COUNT(*) FILTER (WHERE "customerType" = 'organization' AND ("organizationName" IS NULL OR BTRIM("organizationName") = ''))::int AS "organizationsMissingName",
       COUNT(*) FILTER (WHERE reference IS NULL OR BTRIM(reference) = '')::int AS "missingReferences"
     FROM "customer"
     WHERE "deletedAt" IS NULL`
  );
  const relationshipResult = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM "booking" b LEFT JOIN "customer" c
          ON c.id = b."customerId" AND c."organizationId" = b."organizationId"
          WHERE c.id IS NULL)::int AS "brokenBookingRelationships",
       (SELECT COUNT(*) FROM "order" o LEFT JOIN "customer" c
          ON c.id = o."customerId" AND c."organizationId" = o."organizationId"
          WHERE c.id IS NULL)::int AS "brokenOrderRelationships"`
  );
  console.log(JSON.stringify({
    environment: requestedEnvironment,
    readOnly: true,
    ...result.rows[0],
    ...qualityResult.rows[0],
    ...relationshipResult.rows[0],
  }, null, 2));
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`REEBS ${requestedEnvironment} customer audit failed safely: ${error.code || "query_error"}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
