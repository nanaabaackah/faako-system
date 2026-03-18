/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "discount" (
    "id" SERIAL PRIMARY KEY,
    "code" TEXT UNIQUE NOT NULL,
    "type" TEXT NOT NULL,
    "value" NUMERIC NOT NULL,
    "minOrderValue" NUMERIC,
    "expiryDate" DATE,
    "scope" TEXT,
    "segment" TEXT,
    "reward" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'PERCENTAGE'`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "value" NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "minOrderValue" NUMERIC`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "expiryDate" DATE`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "scope" TEXT`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "segment" TEXT`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "reward" TEXT`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "discount_code_key" ON "discount" ("code")`,
];

const ensureDiscountTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Discount table check failed:", err?.message || err);
    }
  }
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeDiscount = (row) => ({
  id: row.id,
  code: row.code,
  type: row.type,
  value: row.value !== null ? Number(row.value) : null,
  minOrderValue: row.minOrderValue !== null ? Number(row.minOrderValue) : null,
  expiryDate: row.expiryDate,
  scope: row.scope || "both",
  segment: row.segment || "all",
  reward: row.reward,
  usageCount: Number(row.usageCount || 0),
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry < today;
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      },
      body: "",
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureDiscountTable(client);

    if (event.httpMethod === "GET") {
      const code = cleanText(event.queryStringParameters?.code || "");
      if (code) {
        const result = await client.query(
          `SELECT id, code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                  "usageCount", "isActive", "createdAt", "updatedAt"
           FROM "discount"
           WHERE code = $1`,
          [code.toUpperCase()]
        );
        if (result.rowCount === 0) {
          return json(404, { error: "Discount code not found." });
        }
        const discount = normalizeDiscount(result.rows[0]);
        if (!discount.isActive || isExpired(discount.expiryDate)) {
          return json(400, { error: "Invalid or expired code." });
        }
        return json(200, discount);
      }

      const list = await client.query(
        `SELECT id, code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                "usageCount", "isActive", "createdAt", "updatedAt"
         FROM "discount"
         ORDER BY "createdAt" DESC`
      );
      return json(200, (list.rows || []).map(normalizeDiscount));
    }

    if (event.httpMethod === "POST") {
      let data = {};
      try {
        data = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Invalid JSON body." });
      }

      if (data.seed) {
        const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM "discount"`);
        if ((countRes.rows[0]?.count || 0) > 0) {
          return json(200, { seeded: false });
        }
        const seeded = await client.query(
          `INSERT INTO "discount" (code, type, value, "expiryDate", "minOrderValue", scope, segment, reward, "isActive")
           VALUES
            ('WELCOME10','PERCENTAGE',10,'2026-01-31',0,'both','all','10% off your first order',true),
            ('JANPOP','FIXED',25,'2026-01-31',150,'rental','rental clients','Free popcorn machine in January',true),
            ('XMAS20','PERCENTAGE',20,'2025-12-31',200,'retail','retail shoppers','Holiday promo',false)
           RETURNING id, code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                     "usageCount", "isActive", "createdAt", "updatedAt"`
        );
        return json(200, { seeded: true, items: seeded.rows.map(normalizeDiscount) });
      }

      const code = cleanText(data.code);
      if (!code) return json(400, { error: "Code is required." });

      const type = cleanText(data.type || "").toUpperCase();
      const normalizedType = ["PERCENTAGE", "FIXED"].includes(type) ? type : "PERCENTAGE";
      const value = toNumber(data.value);
      if (value === null) return json(400, { error: "Value is required." });

      const minOrderValue = toNumber(data.minOrderValue);
      const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
      if (data.expiryDate && Number.isNaN(expiryDate?.getTime())) {
        return json(400, { error: "Invalid expiry date." });
      }

      const scope = cleanText(data.scope || "both");
      const segment = cleanText(data.segment || "all");
      const reward = cleanText(data.reward || "");
      const isActive = data.isActive === false ? false : true;

      const result = await client.query(
        `INSERT INTO "discount"
         (code, type, value, "minOrderValue", "expiryDate", scope, segment, reward, "isActive", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
         RETURNING id, code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                   "usageCount", "isActive", "createdAt", "updatedAt"`,
        [
          code.toUpperCase(),
          normalizedType,
          value,
          minOrderValue,
          expiryDate ? expiryDate.toISOString().slice(0, 10) : null,
          scope || "both",
          segment || "all",
          reward || null,
          isActive,
        ]
      );

      return json(200, normalizeDiscount(result.rows[0]));
    }

    if (event.httpMethod === "PUT") {
      let data = {};
      try {
        data = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Invalid JSON body." });
      }

      const id = Number(data.id);
      if (!Number.isFinite(id)) return json(400, { error: "id is required." });
      const isActive = data.isActive === undefined ? null : Boolean(data.isActive);

      if (isActive === null) {
        return json(400, { error: "No updates provided." });
      }

      const result = await client.query(
        `UPDATE "discount"
         SET "isActive" = $1, "updatedAt" = NOW()
         WHERE id = $2
         RETURNING id, code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                   "usageCount", "isActive", "createdAt", "updatedAt"`,
        [isActive, id]
      );

      if (result.rowCount === 0) {
        return json(404, { error: "Discount not found." });
      }

      return json(200, normalizeDiscount(result.rows[0]));
    }

    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("❌ Marketing error:", err);
    return json(500, { error: "Failed to process marketing data" });
  } finally {
    await client.end().catch(() => {});
  }
}
