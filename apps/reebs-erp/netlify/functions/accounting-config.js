/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireUser } from "./_shared/userAuth.js";

const RESPONSE_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Organization-Id",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const json = (statusCode, body) => ({
  statusCode,
  headers: RESPONSE_HEADERS,
  body: JSON.stringify(body),
});

const BALANCE_DEFAULTS = {
  cashOnHand: "0",
  bankBalance: "0",
  accountsReceivable: "0",
  inventoryValue: "0",
  prepaidExpenses: "0",
  otherCurrentAssets: "0",
  fixedAssets: "0",
  otherAssets: "0",
  accountsPayable: "0",
  taxesPayable: "0",
  accruedExpenses: "0",
  shortTermLoans: "0",
  longTermLoans: "0",
  ownerEquity: "0",
  retainedEarnings: "0",
};

const TAX_INPUT_DEFAULTS = {
  exemptSales: "0",
  inputVatCredits: "0",
  allowableDeductions: "0",
  withholdingCredits: "0",
  grossProduction: "0",
};

const GHANA_TAX_DEFAULTS = {
  vatCoreRate: "0.125",
  nhilRate: "0.025",
  getFundRate: "0.025",
  covidRate: "0",
  corporateRate: "0.25",
  corporateCategory: "general",
  gslCategory: "categoryC",
  fsrlEnabled: false,
};

const VALID_CORPORATE_CATEGORIES = new Set([
  "general",
  "hotel",
  "mining",
  "nonTraditional",
  "bankAgriLeasing",
  "lottery",
  "custom",
]);

const VALID_GSL_CATEGORIES = new Set([
  "none",
  "categoryA",
  "categoryBGold",
  "categoryBOther",
  "categoryC",
]);

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "accountingConfig" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "balanceInputs" JSONB,
    "taxInputs" JSONB,
    "ghanaTaxConfig" JSONB,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "balanceInputs" JSONB`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "taxInputs" JSONB`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "ghanaTaxConfig" JSONB`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "accountingConfig" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "accountingConfig_org_key"
   ON "accountingConfig" ("organizationId")`,
];

const ensureAccountingConfigTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Accounting config table check failed:", err?.message || err);
    }
  }
};

const roundToPlaces = (value, places) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const toNumericString = (value, fallback, places = 2) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return String(roundToPlaces(parsed, places));
};

const normalizeStringMap = (value, defaults, places = 2) => {
  const source = value && typeof value === "object" ? value : {};
  return Object.keys(defaults).reduce((acc, key) => {
    acc[key] = toNumericString(source[key], defaults[key], places);
    return acc;
  }, {});
};

const normalizeBalanceInputs = (value) =>
  normalizeStringMap(value, BALANCE_DEFAULTS, 2);

const normalizeTaxInputs = (value) =>
  normalizeStringMap(value, TAX_INPUT_DEFAULTS, 2);

const normalizeGhanaTaxConfig = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return {
    vatCoreRate: toNumericString(source.vatCoreRate, GHANA_TAX_DEFAULTS.vatCoreRate, 4),
    nhilRate: toNumericString(source.nhilRate, GHANA_TAX_DEFAULTS.nhilRate, 4),
    getFundRate: toNumericString(source.getFundRate, GHANA_TAX_DEFAULTS.getFundRate, 4),
    covidRate: toNumericString(source.covidRate, GHANA_TAX_DEFAULTS.covidRate, 4),
    corporateRate: toNumericString(source.corporateRate, GHANA_TAX_DEFAULTS.corporateRate, 4),
    corporateCategory: VALID_CORPORATE_CATEGORIES.has(source.corporateCategory)
      ? source.corporateCategory
      : GHANA_TAX_DEFAULTS.corporateCategory,
    gslCategory: VALID_GSL_CATEGORIES.has(source.gslCategory)
      ? source.gslCategory
      : GHANA_TAX_DEFAULTS.gslCategory,
    fsrlEnabled: Boolean(source.fsrlEnabled),
  };
};

const toResponseBody = (row) => ({
  balanceInputs: row?.balanceInputs ? normalizeBalanceInputs(row.balanceInputs) : null,
  taxInputs: row?.taxInputs ? normalizeTaxInputs(row.taxInputs) : null,
  ghanaTaxConfig: row?.ghanaTaxConfig ? normalizeGhanaTaxConfig(row.ghanaTaxConfig) : null,
  updatedAt: row?.updatedAt || null,
});

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: "" };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();

    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(401, { error: "Unauthorized" });
    }

    await ensureAccountingConfigTable(client);

    const organizationId = Number(authUser.organizationId);

    if (event.httpMethod === "GET") {
      const result = await client.query(
        `SELECT "balanceInputs", "taxInputs", "ghanaTaxConfig", "updatedAt"
         FROM "accountingConfig"
         WHERE "organizationId" = $1
         LIMIT 1`,
        [organizationId]
      );

      if (result.rowCount === 0) {
        return json(200, {
          balanceInputs: null,
          taxInputs: null,
          ghanaTaxConfig: null,
          updatedAt: null,
        });
      }

      return json(200, toResponseBody(result.rows[0]));
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method Not Allowed" });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    const hasBalanceInputs = payload.balanceInputs && typeof payload.balanceInputs === "object";
    const hasTaxInputs = payload.taxInputs && typeof payload.taxInputs === "object";
    const hasGhanaTaxConfig = payload.ghanaTaxConfig && typeof payload.ghanaTaxConfig === "object";

    if (!hasBalanceInputs && !hasTaxInputs && !hasGhanaTaxConfig) {
      return json(400, { error: "At least one config section is required." });
    }

    const currentResult = await client.query(
      `SELECT "balanceInputs", "taxInputs", "ghanaTaxConfig"
       FROM "accountingConfig"
       WHERE "organizationId" = $1
       LIMIT 1`,
      [organizationId]
    );

    const currentRow = currentResult.rows[0] || null;
    const nextBalanceInputs = hasBalanceInputs
      ? normalizeBalanceInputs(payload.balanceInputs)
      : currentRow?.balanceInputs
        ? normalizeBalanceInputs(currentRow.balanceInputs)
        : null;
    const nextTaxInputs = hasTaxInputs
      ? normalizeTaxInputs(payload.taxInputs)
      : currentRow?.taxInputs
        ? normalizeTaxInputs(currentRow.taxInputs)
        : null;
    const nextGhanaTaxConfig = hasGhanaTaxConfig
      ? normalizeGhanaTaxConfig(payload.ghanaTaxConfig)
      : currentRow?.ghanaTaxConfig
        ? normalizeGhanaTaxConfig(currentRow.ghanaTaxConfig)
        : null;

    const result = await client.query(
      `INSERT INTO "accountingConfig" (
         "organizationId",
         "balanceInputs",
         "taxInputs",
         "ghanaTaxConfig",
         "createdByUserId",
         "updatedByUserId",
         "createdAt",
         "updatedAt"
       )
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $5, NOW(), NOW())
       ON CONFLICT ("organizationId") DO UPDATE
       SET "balanceInputs" = EXCLUDED."balanceInputs",
           "taxInputs" = EXCLUDED."taxInputs",
           "ghanaTaxConfig" = EXCLUDED."ghanaTaxConfig",
           "updatedByUserId" = EXCLUDED."updatedByUserId",
           "updatedAt" = NOW()
       RETURNING "balanceInputs", "taxInputs", "ghanaTaxConfig", "updatedAt"`,
      [
        organizationId,
        nextBalanceInputs ? JSON.stringify(nextBalanceInputs) : null,
        nextTaxInputs ? JSON.stringify(nextTaxInputs) : null,
        nextGhanaTaxConfig ? JSON.stringify(nextGhanaTaxConfig) : null,
        Number(authUser.id),
      ]
    );

    return json(200, toResponseBody(result.rows[0]));
  } catch (err) {
    console.error("❌ Accounting config error:", err);
    return json(500, { error: "Failed to load or save accounting settings." });
  } finally {
    await client.end().catch(() => {});
  }
}
