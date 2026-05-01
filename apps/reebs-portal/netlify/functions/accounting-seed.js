/* eslint-disable no-undef */
/**
 * One-time seed endpoint (owner only).
 * Seeds: Chart of Accounts, Tax Rates, System Config.
 * Safe to call multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
 * POST /.netlify/functions/accounting-seed
 */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import {
  assertSeedActionsAllowed,
  requireAdmin,
  respond,
} from "./_shared/internalApi.js";

const METHODS = "POST,OPTIONS";
const json = (event, code, payload) => respond(event, code, payload, { methods: METHODS });

// ── Chart of Accounts ──────────────────────────────────────────────────────────
const COA = [
  // ASSETS
  { code: "1000", name: "Cash on Hand",                              type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1010", name: "MTN Mobile Money",                          type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1020", name: "Vodafone Cash",                             type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1030", name: "Bank Account",                              type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1100", name: "Accounts Receivable",                       type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1200", name: "Inventory — Retail Stock",                  type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1210", name: "Rental Assets (at cost)",                   type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1220", name: "Accumulated Depreciation — Rental Assets",  type: "ASSET",     nb: "CREDIT", sys: false },
  { code: "1300", name: "Prepayments & Deposits",                    type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1400", name: "Other Current Assets",                      type: "ASSET",     nb: "DEBIT",  sys: false },
  { code: "1500", name: "Input VAT Recoverable",                     type: "ASSET",     nb: "DEBIT",  sys: true  },
  // LIABILITIES
  { code: "2000", name: "Accounts Payable",                          type: "LIABILITY", nb: "CREDIT", sys: false },
  { code: "2100", name: "VAT Payable",                               type: "LIABILITY", nb: "CREDIT", sys: true  },
  { code: "2110", name: "COVID-19 Health Recovery Levy Payable",     type: "LIABILITY", nb: "CREDIT", sys: true  },
  { code: "2115", name: "NHIL Payable",                              type: "LIABILITY", nb: "CREDIT", sys: true  },
  { code: "2116", name: "GETFund Levy Payable",                      type: "LIABILITY", nb: "CREDIT", sys: true  },
  { code: "2120", name: "WHT Payable — Individuals",                 type: "LIABILITY", nb: "CREDIT", sys: true  },
  { code: "2130", name: "WHT Payable — Companies",                   type: "LIABILITY", nb: "CREDIT", sys: true  },
  { code: "2200", name: "Deferred Revenue — Rental",                 type: "LIABILITY", nb: "CREDIT", sys: true  },
  { code: "2300", name: "Customer Deposits (Rental)",                type: "LIABILITY", nb: "CREDIT", sys: false },
  { code: "2400", name: "SSNIT Payable",                             type: "LIABILITY", nb: "CREDIT", sys: false },
  { code: "2500", name: "PAYE Payable",                              type: "LIABILITY", nb: "CREDIT", sys: false },
  { code: "2600", name: "Other Current Liabilities",                 type: "LIABILITY", nb: "CREDIT", sys: false },
  // EQUITY
  { code: "3000", name: "Owner's Capital",                           type: "EQUITY",    nb: "CREDIT", sys: false },
  { code: "3100", name: "Retained Earnings",                         type: "EQUITY",    nb: "CREDIT", sys: true  },
  { code: "3200", name: "Current Year Earnings",                     type: "EQUITY",    nb: "CREDIT", sys: true  },
  // REVENUE
  { code: "4000", name: "Retail Sales Revenue",                      type: "REVENUE",   nb: "CREDIT", sys: false },
  { code: "4100", name: "Rental Income",                             type: "REVENUE",   nb: "CREDIT", sys: false },
  { code: "4200", name: "Security Deposit Forfeiture Income",        type: "REVENUE",   nb: "CREDIT", sys: false },
  { code: "4300", name: "Other Income",                              type: "REVENUE",   nb: "CREDIT", sys: false },
  // COST OF SALES
  { code: "5000", name: "Cost of Goods Sold — Retail",              type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "5100", name: "Rental Asset Depreciation",                 type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "5200", name: "Rental Maintenance & Repairs",              type: "EXPENSE",   nb: "DEBIT",  sys: false },
  // OPERATING EXPENSES
  { code: "6000", name: "Staff Salaries",                            type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6010", name: "SSNIT Contribution — Employer",            type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6100", name: "Rent & Utilities",                          type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6200", name: "Marketing & Advertising",                   type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6300", name: "Transport & Logistics",                     type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6400", name: "Bank Charges & Mobile Money Fees",          type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6500", name: "Professional Fees",                         type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6600", name: "Office Supplies",                           type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6700", name: "Depreciation — Non-Rental Assets",         type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "6800", name: "Miscellaneous Expenses",                    type: "EXPENSE",   nb: "DEBIT",  sys: false },
  // TAX EXPENSE
  { code: "7000", name: "Income Tax Expense",                        type: "EXPENSE",   nb: "DEBIT",  sys: false },
  { code: "7100", name: "Other Tax Charges",                         type: "EXPENSE",   nb: "DEBIT",  sys: false },
];

// ── Tax Rates (basis points) ───────────────────────────────────────────────────
// rateInBps: 1500 = 15.00%, 250 = 2.50%, 100 = 1.00%
const TAX_RATES = [
  { taxType: "VAT",            label: "Value Added Tax (Standard Rate)",       rateInBps: 1500, from: "2023-01-01", coaCode: "2100" },
  { taxType: "NHIL",           label: "National Health Insurance Levy",         rateInBps:  250, from: "2023-01-01", coaCode: "2115" },
  { taxType: "GETFUND",        label: "GETFund Levy",                           rateInBps:  250, from: "2023-01-01", coaCode: "2116" },
  { taxType: "COVID_HRL",      label: "COVID-19 Health Recovery Levy",          rateInBps:  100, from: "2021-01-01", coaCode: "2110" },
  { taxType: "WHT_INDIVIDUAL", label: "Withholding Tax — Individuals",          rateInBps:  800, from: "2024-01-01", coaCode: "2120" },
  { taxType: "WHT_COMPANY",    label: "Withholding Tax — Companies",            rateInBps:  800, from: "2024-01-01", coaCode: "2130" },
  { taxType: "SSNIT_EMPLOYER", label: "SSNIT Contribution — Employer (13%)",   rateInBps: 1300, from: "2024-01-01", coaCode: "2400" },
  { taxType: "SSNIT_EMPLOYEE", label: "SSNIT Contribution — Employee (5.5%)",  rateInBps:  550, from: "2024-01-01", coaCode: "2400" },
];

// ── System Config ──────────────────────────────────────────────────────────────
const SYSTEM_CONFIG = [
  { key: "BUSINESS_NAME",              value: "REEBS",       description: "Legal trading name" },
  { key: "TIN",                        value: "[TIN]",        description: "Ghana Revenue Authority TIN — update before go-live" },
  { key: "VAT_REG_NUMBER",             value: "[VAT_REG]",   description: "GRA VAT Registration Number — update before go-live" },
  { key: "BASE_CURRENCY",              value: "GHS",          description: "ISO 4217 base currency" },
  { key: "PESEWAS_PER_UNIT",           value: "100",          description: "Monetary subunit multiplier" },
  { key: "FINANCIAL_YEAR_START",       value: "01-01",        description: "Financial year start MM-DD" },
  { key: "OPENING_BALANCE_DATE",       value: "2025-01-01",  description: "Opening balance date ISO 8601" },
  { key: "VAT_SCHEME",                 value: "STANDARD",     description: "STANDARD (21% total) or SIMPLIFIED (16% total)" },
  { key: "INVOICE_SEQUENCE_CURRENT",   value: "0",            description: "Current invoice sequence counter — auto-incremented on each invoice" },
  { key: "HISTORICAL_IMPORT_START",    value: "2024-01-01",  description: "Earliest period covered by historical import" },
  { key: "GO_LIVE_DATE",               value: "2025-07-01",  description: "Date from which real-time transactions begin — update at go-live" },
];

const seedCoa = async (client, organizationId) => {
  let inserted = 0;
  for (const acct of COA) {
    const res = await client.query(
      `INSERT INTO "chartOfAccount"
         ("organizationId","accountCode","accountName","accountType","normalBalance","isSystemAccount","isActive")
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)
       ON CONFLICT ("organizationId","accountCode") DO NOTHING`,
      [organizationId, acct.code, acct.name, acct.type, acct.nb, acct.sys]
    );
    inserted += res.rowCount;
  }
  return inserted;
};

const seedTaxRates = async (client, organizationId) => {
  let inserted = 0;
  for (const t of TAX_RATES) {
    const coaRes = await client.query(
      `SELECT id FROM "chartOfAccount" WHERE "organizationId"=$1 AND "accountCode"=$2 LIMIT 1`,
      [organizationId, t.coaCode]
    );
    const accountId = coaRes.rows[0]?.id ?? null;
    const res = await client.query(
      `INSERT INTO "taxRate"
         ("organizationId","taxType","label","rateInBps","effectiveFrom","isActive","accountId")
       VALUES ($1,$2,$3,$4,$5::date,TRUE,$6)
       ON CONFLICT DO NOTHING`,
      [organizationId, t.taxType, t.label, t.rateInBps, t.from, accountId]
    );
    inserted += res.rowCount;
  }
  return inserted;
};

const seedSystemConfig = async (client, organizationId) => {
  let inserted = 0;
  for (const cfg of SYSTEM_CONFIG) {
    const res = await client.query(
      `INSERT INTO "systemConfig" ("organizationId","key","value","description")
       VALUES ($1,$2,$3,$4)
       ON CONFLICT ("organizationId","key") DO NOTHING`,
      [organizationId, cfg.key, cfg.value, cfg.description]
    );
    inserted += res.rowCount;
  }
  return inserted;
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "POST").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "POST") return json(event, 405, { error: "Method not allowed." });

  try {
    assertSeedActionsAllowed();
  } catch (error) {
    return json(event, error?.statusCode || 403, {
      error: error?.message || "Seed actions are disabled.",
    });
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: resolvePgSslConfig() });
  try {
    await client.connect();
    const auth = await requireAdmin(client, event, {
      methods: METHODS,
      roleError: "Only owners and admins can seed accounting data.",
    });
    if (auth.errorResponse) return auth.errorResponse;

    const { organizationId } = auth;

    const coaCount    = await seedCoa(client, organizationId);
    const taxCount    = await seedTaxRates(client, organizationId);
    const cfgCount    = await seedSystemConfig(client, organizationId);

    return json(event, 200, {
      message: "Accounting seed complete.",
      coaAccountsInserted:   coaCount,
      taxRatesInserted:      taxCount,
      systemConfigInserted:  cfgCount,
      note: "Update TIN and VAT_REG_NUMBER in System Config before go-live.",
    });
  } catch (err) {
    console.error("accounting-seed error", err);
    return json(event, err?.statusCode || 500, { error: err?.message || "Seed failed." });
  } finally {
    await client.end().catch(() => {});
  }
}
