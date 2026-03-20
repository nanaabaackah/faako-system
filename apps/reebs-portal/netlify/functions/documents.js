/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireUser } from "./_shared/userAuth.js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "document" (
    "id" SERIAL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "data" TEXT NOT NULL,
    "source" TEXT DEFAULT 'upload',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "category" TEXT`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "fileName" TEXT`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "mimeType" TEXT`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "size" INTEGER`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "data" TEXT`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'upload'`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
];

const ensureDocumentTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Document table check failed:", err?.message || err);
    }
  }
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(401, { error: "Unauthorized" });
    }
    const organizationId = authUser.organizationId;
    await ensureDocumentTable(client);
    const orgColumnRes = await client.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'document'
         AND column_name = 'organizationId'
       LIMIT 1`
    );
    const hasOrganizationId = orgColumnRes.rowCount > 0;

    if (event.httpMethod === "GET") {
      const id = Number(event.queryStringParameters?.id);
      if (Number.isFinite(id) && id > 0) {
        const result = await client.query(
          `SELECT id, title, category, "fileName", "mimeType", size, data, source, "createdAt"
           FROM "document"
           WHERE id = $1${hasOrganizationId ? ` AND "organizationId" = $2` : ""}`,
          hasOrganizationId ? [id, organizationId] : [id]
        );
        if (result.rowCount === 0) {
          return json(404, { error: "Document not found." });
        }
        return json(200, result.rows[0]);
      }

      const list = await client.query(
        `SELECT id, title, category, "fileName", "mimeType", size, source, "createdAt"
         FROM "document"
         ${hasOrganizationId ? `WHERE "organizationId" = $1` : ""}
         ORDER BY "createdAt" DESC, id DESC`,
        hasOrganizationId ? [organizationId] : []
      );
      return json(200, list.rows || []);
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

    const title = cleanText(payload.title) || cleanText(payload.fileName);
    const category = cleanText(payload.category) || "Other";
    const fileName = cleanText(payload.fileName);
    const mimeType = cleanText(payload.mimeType) || "application/octet-stream";
    const data = cleanText(payload.data);
    const source = cleanText(payload.source) || "upload";

    if (!title) {
      return json(400, { error: "Title is required." });
    }
    if (!fileName) {
      return json(400, { error: "fileName is required." });
    }
    if (!data) {
      return json(400, { error: "Document data is required." });
    }

    let size = Number(payload.size);
    if (!Number.isFinite(size) || size <= 0) {
      try {
        size = Buffer.from(data, "base64").length;
      } catch {
        size = null;
      }
    }

    const result = await client.query(
      `INSERT INTO "document" (${hasOrganizationId ? `"organizationId", ` : ""}title, category, "fileName", "mimeType", size, data, source, "createdAt", "updatedAt")
       VALUES (${hasOrganizationId ? `$1, ` : ""}$${hasOrganizationId ? 2 : 1}, $${hasOrganizationId ? 3 : 2}, $${hasOrganizationId ? 4 : 3}, $${hasOrganizationId ? 5 : 4}, $${hasOrganizationId ? 6 : 5}, $${hasOrganizationId ? 7 : 6}, $${hasOrganizationId ? 8 : 7}, NOW(), NOW())
       RETURNING id, title, category, "fileName", "mimeType", size, source, "createdAt"`,
      hasOrganizationId
        ? [organizationId, title, category, fileName, mimeType, size, data, source]
        : [title, category, fileName, mimeType, size, data, source]
    );

    return json(200, result.rows[0]);
  } catch (err) {
    console.error("❌ Document error:", err);
    return json(500, { error: "Failed to process documents." });
  } finally {
    await client.end().catch(() => {});
  }
}
