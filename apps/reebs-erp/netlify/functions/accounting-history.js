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

const MANUAL_SALES_YEAR = 2024;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const EMPTY_MONTHLY_SALES = Object.fromEntries(MONTH_KEYS.map((key) => [key, 0]));

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "accountingManualSales" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "year" INTEGER NOT NULL,
    "monthlySales" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "accountingManualSales" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "accountingManualSales" ADD COLUMN IF NOT EXISTS "year" INTEGER NOT NULL DEFAULT ${MANUAL_SALES_YEAR}`,
  `ALTER TABLE "accountingManualSales" ADD COLUMN IF NOT EXISTS "monthlySales" JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE "accountingManualSales" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER`,
  `ALTER TABLE "accountingManualSales" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER`,
  `ALTER TABLE "accountingManualSales" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "accountingManualSales" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "accountingManualSales_org_year_key"
   ON "accountingManualSales" ("organizationId", "year")`,
];

const ensureAccountingHistoryTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Accounting history table check failed:", err?.message || err);
    }
  }
};

const parseYear = (value) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return null;
  }
  return year;
};

const toMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
};

const normalizeMonthlySales = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return MONTH_KEYS.reduce((acc, key) => {
    acc[key] = toMoney(source[key]);
    return acc;
  }, { ...EMPTY_MONTHLY_SALES });
};

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

    await ensureAccountingHistoryTable(client);

    if (event.httpMethod === "GET") {
      const rawYear = event.queryStringParameters?.year;
      const hasYearFilter = typeof rawYear === "string" ? rawYear.trim() !== "" : rawYear != null;

      if (hasYearFilter) {
        const year = parseYear(rawYear);
        if (!year) {
          return json(400, { error: "A valid year is required." });
        }

        const result = await client.query(
          `SELECT "year", "monthlySales", "updatedAt"
           FROM "accountingManualSales"
           WHERE "organizationId" = $1 AND "year" = $2
           LIMIT 1`,
          [Number(authUser.organizationId), year]
        );

        if (result.rowCount === 0) {
          return json(200, {
            year,
            monthlySales: { ...EMPTY_MONTHLY_SALES },
            updatedAt: null,
          });
        }

        return json(200, {
          year,
          monthlySales: normalizeMonthlySales(result.rows[0]?.monthlySales),
          updatedAt: result.rows[0]?.updatedAt || null,
        });
      }

      const result = await client.query(
        `SELECT "year", "monthlySales", "updatedAt"
         FROM "accountingManualSales"
         WHERE "organizationId" = $1
         ORDER BY "year" ASC`,
        [Number(authUser.organizationId)]
      );

      return json(200, {
        years: (result.rows || []).map((row) => ({
          year: Number(row?.year || MANUAL_SALES_YEAR),
          monthlySales: normalizeMonthlySales(row?.monthlySales),
          updatedAt: row?.updatedAt || null,
        })),
      });
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

    const year = parseYear(payload.year);
    if (!year) {
      return json(400, { error: "A valid year is required." });
    }

    const monthlySales = normalizeMonthlySales(payload.monthlySales);
    const result = await client.query(
      `INSERT INTO "accountingManualSales" (
         "organizationId",
         "year",
         "monthlySales",
         "createdByUserId",
         "updatedByUserId",
         "createdAt",
         "updatedAt"
       )
       VALUES ($1, $2, $3::jsonb, $4, $4, NOW(), NOW())
       ON CONFLICT ("organizationId", "year") DO UPDATE
       SET "monthlySales" = EXCLUDED."monthlySales",
           "updatedByUserId" = EXCLUDED."updatedByUserId",
           "updatedAt" = NOW()
       RETURNING "year", "monthlySales", "updatedAt"`,
      [
        Number(authUser.organizationId),
        year,
        JSON.stringify(monthlySales),
        Number(authUser.id),
      ]
    );

    return json(200, {
      year,
      monthlySales: normalizeMonthlySales(result.rows[0]?.monthlySales),
      updatedAt: result.rows[0]?.updatedAt || null,
    });
  } catch (err) {
    console.error("❌ Accounting history error:", err);
    return json(500, { error: "Failed to load or save accounting history." });
  } finally {
    await client.end().catch(() => {});
  }
}
