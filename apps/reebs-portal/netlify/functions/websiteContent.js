/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { resolveOrganizationId } from "./_shared/organization.js";

const METHODS = "GET,POST,PATCH,OPTIONS";

const json = (event, statusCode, payload) =>
  respond(event, statusCode, payload, { methods: METHODS });

const ensureWebsiteContentSchema = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "websiteContent" (
      "id" SERIAL PRIMARY KEY,
      "organizationId" INTEGER NOT NULL DEFAULT 1,
      "section" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER NOT NULL DEFAULT 1`);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "section" TEXT NOT NULL DEFAULT 'general'`);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "key" TEXT NOT NULL DEFAULT 'content'`);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await client.query(`ALTER TABLE "websiteContent" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "websiteContent_org_section_key_key"
      ON "websiteContent" ("organizationId", "section", "key")
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "websiteContent_org_section_active_sort_idx"
      ON "websiteContent" ("organizationId", "section", "isActive", "sortOrder")
  `);
};

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};

const normalizeToken = (value, fallback = "") => {
  const normalized = String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized;
};

const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};

const toBool = (value, fallback = true) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "active"].includes(normalized)) return true;
  if (["0", "false", "no", "inactive"].includes(normalized)) return false;
  return fallback;
};

const normalizePayload = (body) => {
  if (body && Object.prototype.hasOwnProperty.call(body, "payload")) {
    return body.payload;
  }

  const {
    organizationId,
    section,
    key,
    contentKey,
    sortOrder,
    isActive,
    ...payload
  } = body || {};
  return payload;
};

const rowToContent = (row) => ({
  id: row.id,
  organizationId: row.organizationId,
  section: row.section,
  key: row.key,
  payload: row.payload || {},
  sortOrder: row.sortOrder || 0,
  isActive: row.isActive !== false,
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

const listSection = async (client, organizationId, section, { includeInactive = false } = {}) => {
  const result = await client.query(
    `SELECT id, "organizationId", section, "key", payload, "sortOrder", "isActive", "createdAt", "updatedAt"
     FROM "websiteContent"
     WHERE "organizationId" = $1
       AND section = $2
       ${includeInactive ? "" : `AND "isActive" = true`}
     ORDER BY "sortOrder" ASC, "createdAt" DESC, id DESC`,
    [organizationId, section]
  );
  return result.rows.map(rowToContent);
};

const getContent = async (client, organizationId, section, key) => {
  const result = await client.query(
    `SELECT id, "organizationId", section, "key", payload, "sortOrder", "isActive", "createdAt", "updatedAt"
     FROM "websiteContent"
     WHERE "organizationId" = $1
       AND section = $2
       AND "key" = $3
       AND "isActive" = true
     LIMIT 1`,
    [organizationId, section, key]
  );
  return result.rows[0] ? rowToContent(result.rows[0]) : null;
};

const upsertContent = async (client, organizationId, body) => {
  const section = normalizeToken(body?.section || body?.group);
  const payload = normalizePayload(body);
  const fallbackKey = payload?.title || payload?.name || "config";
  const key = normalizeToken(body?.key || body?.contentKey, fallbackKey);

  if (!section) {
    const error = new Error("Content section is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!key) {
    const error = new Error("Content key is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!payload || typeof payload !== "object") {
    const error = new Error("Content payload must be an object or array.");
    error.statusCode = 400;
    throw error;
  }

  const sortOrder = toInt(body?.sortOrder, 0);
  const isActive = toBool(body?.isActive, true);
  const result = await client.query(
    `INSERT INTO "websiteContent" (
       "organizationId", section, "key", payload, "sortOrder", "isActive", "createdAt", "updatedAt"
     )
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW(), NOW())
     ON CONFLICT ("organizationId", section, "key") DO UPDATE
     SET payload = EXCLUDED.payload,
         "sortOrder" = EXCLUDED."sortOrder",
         "isActive" = EXCLUDED."isActive",
         "updatedAt" = NOW()
     RETURNING id, "organizationId", section, "key", payload, "sortOrder", "isActive", "createdAt", "updatedAt"`,
    [organizationId, section, key, JSON.stringify(payload), sortOrder, isActive]
  );
  return rowToContent(result.rows[0]);
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }

  if (!["GET", "POST", "PATCH"].includes(method)) {
    return json(event, 405, { error: "Method not allowed." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureWebsiteContentSchema(client);

    if (method === "GET") {
      const section = normalizeToken(event.queryStringParameters?.section || event.queryStringParameters?.group);
      const key = normalizeToken(event.queryStringParameters?.key || event.queryStringParameters?.contentKey);
      if (!section) {
        return json(event, 400, { error: "Content section is required." });
      }

      const organizationId = await resolveOrganizationId(client, event, null, 1);
      if (key) {
        const content = await getContent(client, organizationId, section, key);
        return json(event, 200, { content });
      }

      const items = await listSection(client, organizationId, section);
      return json(event, 200, { items });
    }

    const auth = await requireInternalUser(client, event, {
      methods: METHODS,
      roles: ["owner", "admin"],
      roleError: "Only owners and admins can manage website content.",
    });
    if (auth.errorResponse) return auth.errorResponse;

    const body = parseBody(event);
    if (!body) {
      return json(event, 400, { error: "Invalid JSON body." });
    }

    const content = await upsertContent(client, auth.organizationId, body);
    return json(event, method === "POST" ? 201 : 200, { content });
  } catch (err) {
    console.error("websiteContent error", err);
    const status = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, status, {
      error: status === 500 ? "Failed to process website content." : err?.message,
      detail: err?.message || null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
