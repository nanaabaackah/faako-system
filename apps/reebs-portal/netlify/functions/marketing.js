/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,POST,PUT,OPTIONS" });

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "discount" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
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
  `ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER NOT NULL DEFAULT 1`,
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
  `CREATE INDEX IF NOT EXISTS "discount_organizationId_idx" ON "discount" ("organizationId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "discount_organizationId_code_key" ON "discount" ("organizationId", "code")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'discount_organizationId_fkey'
     ) THEN
       ALTER TABLE "discount"
         ADD CONSTRAINT "discount_organizationId_fkey"
         FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
         ON DELETE RESTRICT ON UPDATE CASCADE;
     END IF;
   END $$;`,
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
  organizationId: Number(row.organizationId || 0),
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
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }

  if (!["GET", "POST", "PUT"].includes(method)) {
    return json(event, 405, { error: "Method Not Allowed" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const internal = await requireInternalUser(client, event, {
      methods: "GET,POST,PUT,OPTIONS",
      roles: ["owner", "admin", "manager"],
      roleError: "Manager access required.",
    });
    if (internal.errorResponse) {
      return internal.errorResponse;
    }

    const { organizationId } = internal;
    await ensureDiscountTable(client);

    if (method === "GET") {
      const code = cleanText(event.queryStringParameters?.code || "");
      if (code) {
        const result = await client.query(
          `SELECT id, "organizationId", code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                  "usageCount", "isActive", "createdAt", "updatedAt"
           FROM "discount"
           WHERE "organizationId" = $1
             AND code = $2`,
          [organizationId, code.toUpperCase()]
        );
        if (result.rowCount === 0) {
          return json(event, 404, { error: "Discount code not found." });
        }
        const discount = normalizeDiscount(result.rows[0]);
        if (!discount.isActive || isExpired(discount.expiryDate)) {
          return json(event, 400, { error: "Invalid or expired code." });
        }
        return json(event, 200, discount);
      }

      const list = await client.query(
        `SELECT id, "organizationId", code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                "usageCount", "isActive", "createdAt", "updatedAt"
         FROM "discount"
         WHERE "organizationId" = $1
         ORDER BY "createdAt" DESC`,
        [organizationId]
      );
      return json(event, 200, (list.rows || []).map(normalizeDiscount));
    }

    let data = {};
    try {
      data = JSON.parse(event.body || "{}");
    } catch {
      return json(event, 400, { error: "Invalid JSON body." });
    }

    if (method === "POST") {
      if (data.seed) {
        const countRes = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM "discount"
           WHERE "organizationId" = $1`,
          [organizationId]
        );
        if ((countRes.rows[0]?.count || 0) > 0) {
          return json(event, 200, { seeded: false });
        }

        const seeded = await client.query(
          `INSERT INTO "discount"
             ("organizationId", code, type, value, "expiryDate", "minOrderValue", scope, segment, reward, "isActive")
           VALUES
             ($1, 'WELCOME10','PERCENTAGE',10,'2026-01-31',0,'both','all','10% off your first order',true),
             ($1, 'JANPOP','FIXED',25,'2026-01-31',150,'rental','rental clients','Free popcorn machine in January',true),
             ($1, 'XMAS20','PERCENTAGE',20,'2025-12-31',200,'retail','retail shoppers','Holiday promo',false)
           RETURNING id, "organizationId", code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                     "usageCount", "isActive", "createdAt", "updatedAt"`,
          [organizationId]
        );
        return json(event, 200, { seeded: true, items: seeded.rows.map(normalizeDiscount) });
      }

      const code = cleanText(data.code);
      if (!code) return json(event, 400, { error: "Code is required." });

      const type = cleanText(data.type || "").toUpperCase();
      const normalizedType = ["PERCENTAGE", "FIXED"].includes(type) ? type : "PERCENTAGE";
      const value = toNumber(data.value);
      if (value === null) return json(event, 400, { error: "Value is required." });

      const minOrderValue = toNumber(data.minOrderValue);
      const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
      if (data.expiryDate && Number.isNaN(expiryDate?.getTime())) {
        return json(event, 400, { error: "Invalid expiry date." });
      }

      const scope = cleanText(data.scope || "both");
      const segment = cleanText(data.segment || "all");
      const reward = cleanText(data.reward || "");
      const isActive = data.isActive === false ? false : true;

      try {
        const result = await client.query(
          `INSERT INTO "discount"
             ("organizationId", code, type, value, "minOrderValue", "expiryDate", scope, segment, reward, "isActive", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
           RETURNING id, "organizationId", code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                     "usageCount", "isActive", "createdAt", "updatedAt"`,
          [
            organizationId,
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

        return json(event, 200, normalizeDiscount(result.rows[0]));
      } catch (err) {
        if (err?.code === "23505") {
          return json(event, 409, { error: "Discount code already exists." });
        }
        throw err;
      }
    }

    const id = Number(data.id);
    if (!Number.isFinite(id)) return json(event, 400, { error: "id is required." });
    const isActive = data.isActive === undefined ? null : Boolean(data.isActive);

    if (isActive === null) {
      return json(event, 400, { error: "No updates provided." });
    }

    const result = await client.query(
      `UPDATE "discount"
       SET "isActive" = $1, "updatedAt" = NOW()
       WHERE id = $2
         AND "organizationId" = $3
       RETURNING id, "organizationId", code, type, value, "minOrderValue", "expiryDate", scope, segment, reward,
                 "usageCount", "isActive", "createdAt", "updatedAt"`,
      [isActive, id, organizationId]
    );

    if (result.rowCount === 0) {
      return json(event, 404, { error: "Discount not found." });
    }

    return json(event, 200, normalizeDiscount(result.rows[0]));
  } catch (err) {
    console.error("Marketing error:", err);
    return json(event, 500, { error: "Failed to process marketing data" });
  } finally {
    await client.end().catch(() => {});
  }
}
