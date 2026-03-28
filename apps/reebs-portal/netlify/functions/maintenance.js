/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,POST,PUT,OPTIONS" });

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "maintenanceLog" (
    "id" SERIAL PRIMARY KEY,
    "productId" INTEGER NOT NULL,
    "issue" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "resolvedAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "issue" TEXT`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "type" TEXT`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "cost" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open'`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ`,
  `ALTER TABLE "maintenanceLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE INDEX IF NOT EXISTS "maintenanceLog_productId_idx" ON "maintenanceLog" ("productId")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'maintenanceLog_productId_fkey'
     ) THEN
       ALTER TABLE "maintenanceLog"
         ADD CONSTRAINT "maintenanceLog_productId_fkey"
         FOREIGN KEY ("productId") REFERENCES "product"("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$;`,
];

const ensureMaintenanceTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Maintenance table check failed:", err?.message || err);
    }
  }
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return json(event, 204, {});
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const access = await requireInternalUser(client, event, {
      methods: "GET,POST,PUT,OPTIONS",
    });
    if (access.errorResponse) return access.errorResponse;

    const { organizationId } = access;
    await ensureMaintenanceTable(client);

    if (event.httpMethod === "GET") {
      const result = await client.query(
        `SELECT
          m.id,
          m."productId",
          p.name AS "productName",
          p.sku AS "productSku",
          p."isActive",
          m.issue,
          m.type,
          m.cost,
          m.status,
          m.notes,
          m."createdAt",
          m."resolvedAt"
        FROM "maintenanceLog" m
        JOIN "product" p ON p.id = m."productId" AND p."organizationId" = $1
        ORDER BY m."createdAt" DESC, m.id DESC`,
        [organizationId]
      );
      return json(event, 200, result.rows || []);
    }

    if (event.httpMethod !== "POST" && event.httpMethod !== "PUT") {
      return json(event, 405, { error: "Method Not Allowed" });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(event, 400, { error: "Invalid JSON body." });
    }

    if (event.httpMethod === "POST") {
      const productId = Number(payload.productId);
      const issue = cleanText(payload.issue);
      const type = cleanText(payload.type) || "repair";
      const notes = cleanText(payload.notes) || null;
      const costValue = Number(payload.cost);
      const costCents = Number.isFinite(costValue) ? Math.max(0, Math.round(costValue * 100)) : 0;

      if (!Number.isFinite(productId)) {
        return json(event, 400, { error: "productId is required." });
      }
      if (!issue) {
        return json(event, 400, { error: "Issue description is required." });
      }

      const productRes = await client.query(
        `SELECT id
         FROM "product"
         WHERE id = $1 AND "organizationId" = $2
         LIMIT 1`,
        [productId, organizationId]
      );
      if (productRes.rowCount === 0) {
        return json(event, 404, { error: "Product not found." });
      }

      await client.query("BEGIN");
      try {
        const insert = await client.query(
          `INSERT INTO "maintenanceLog"
            ("productId", issue, type, cost, status, notes, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 'open', $5, NOW(), NOW())
           RETURNING id`,
          [productId, issue, type, costCents, notes]
        );

        await client.query(
          `UPDATE "product"
           SET "isActive" = false,
               "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $2`,
          [productId, organizationId]
        );

        await client.query("COMMIT");
        return json(event, 200, { id: insert.rows[0]?.id || null, status: "open" });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    const logId = Number(payload.id);
    const status = cleanText(payload.status).toLowerCase();
    const notes = cleanText(payload.notes) || null;

    if (!Number.isFinite(logId)) {
      return json(event, 400, { error: "Maintenance log id is required." });
    }
    if (!status) {
      return json(event, 400, { error: "Status is required." });
    }

    await client.query("BEGIN");
    try {
      const existing = await client.query(
        `SELECT m."productId", m.status
         FROM "maintenanceLog" m
         JOIN "product" p ON p.id = m."productId"
         WHERE m.id = $1
           AND p."organizationId" = $2
         LIMIT 1`,
        [logId, organizationId]
      );
      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        return json(event, 404, { error: "Maintenance log not found." });
      }
      const productId = existing.rows[0]?.productId;

      await client.query(
        `UPDATE "maintenanceLog"
         SET status = $1,
             notes = COALESCE($2, notes),
             "resolvedAt" = CASE WHEN $1 = 'resolved' THEN NOW() ELSE "resolvedAt" END,
             "updatedAt" = NOW()
         WHERE id = $3`,
        [status, notes, logId]
      );

      if (status === "resolved" && productId) {
        await client.query(
          `UPDATE "product"
           SET "isActive" = true,
               "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $2`,
          [productId, organizationId]
        );
      }

      await client.query("COMMIT");
      return json(event, 200, { id: logId, status });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("❌ Maintenance error:", err);
    return json(event, 500, { error: "Failed to process maintenance." });
  } finally {
    await client.end().catch(() => {});
  }
}
