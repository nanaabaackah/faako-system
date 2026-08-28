/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getEventHeader, getEventIpAddress, writeAuditLog } from "./_shared/auditLog.js";
import { requirePermission, respond } from "./_shared/internalApi.js";

const DOCUMENT_METHODS = "GET,POST,OPTIONS";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

// Only allow safe, non-executable document MIME types.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "document" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER,
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
  `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER`,
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

export const sanitizeDocumentFileName = (value) => {
  const cleaned = cleanText(value)
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 240);
  return cleaned || "";
};

export const documentBytesMatchMimeType = (bytes, mimeType) => {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return false;
  const startsWith = (...signature) => signature.every((value, index) => bytes[index] === value);
  if (mimeType === "application/pdf") return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (mimeType === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (mimeType === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mimeType === "image/gif") return bytes.subarray(0, 6).toString("ascii") === "GIF87a"
    || bytes.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mimeType.startsWith("application/vnd.openxmlformats-officedocument.")) {
    return startsWith(0x50, 0x4b, 0x03, 0x04);
  }
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return !bytes.includes(0);
  }
  return false;
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: DOCUMENT_METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult =
      event.httpMethod === "GET"
        ? await requirePermission(client, event, "documents:read", {
            methods: DOCUMENT_METHODS,
          })
        : await requirePermission(client, event, "documents:write", {
            methods: DOCUMENT_METHODS,
          });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const { authUser, organizationId } = authResult;
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
    if (!hasOrganizationId) {
      return respond(event, 503, { error: "Document tenant isolation is unavailable." }, {
        methods: DOCUMENT_METHODS,
      });
    }

    if (event.httpMethod === "GET") {
      const id = Number(event.queryStringParameters?.id);
      if (Number.isFinite(id) && id > 0) {
        const result = await client.query(
          `SELECT id, title, category, "fileName", "mimeType", size, data, source, "createdAt"
           FROM "document"
           WHERE id = $1 AND "organizationId" = $2`,
          [id, organizationId]
        );
        if (result.rowCount === 0) {
          return respond(event, 404, { error: "Document not found." }, { methods: DOCUMENT_METHODS });
        }
        return respond(event, 200, result.rows[0], { methods: DOCUMENT_METHODS });
      }

      const list = await client.query(
        `SELECT id, title, category, "fileName", "mimeType", size, source, "createdAt"
         FROM "document"
         WHERE "organizationId" = $1
        ORDER BY "createdAt" DESC, id DESC`,
        [organizationId]
      );
      return respond(event, 200, list.rows || [], { methods: DOCUMENT_METHODS });
    }

    if (event.httpMethod !== "POST") {
      return respond(event, 405, { error: "Method Not Allowed" }, { methods: DOCUMENT_METHODS });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return respond(event, 400, { error: "Invalid JSON body." }, { methods: DOCUMENT_METHODS });
    }

    const title = cleanText(payload.title) || cleanText(payload.fileName);
    const category = cleanText(payload.category) || "Other";
    const fileName = sanitizeDocumentFileName(payload.fileName);
    const mimeType = cleanText(payload.mimeType);
    const data = cleanText(payload.data).replace(/\s+/g, "");
    const source = cleanText(payload.source) || "upload";

    if (!mimeType) {
      return respond(event, 400, { error: "mimeType is required." }, { methods: DOCUMENT_METHODS });
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return respond(event, 415, { error: `Unsupported file type: ${mimeType}. Allowed: PDF, images, Word, Excel, PowerPoint, plain text, CSV.` }, { methods: DOCUMENT_METHODS });
    }

    if (!title) {
      return respond(event, 400, { error: "Title is required." }, { methods: DOCUMENT_METHODS });
    }
    if (!fileName) {
      return respond(event, 400, { error: "fileName is required." }, { methods: DOCUMENT_METHODS });
    }
    if (!data) {
      return respond(event, 400, { error: "Document data is required." }, { methods: DOCUMENT_METHODS });
    }
    if (!BASE64_PATTERN.test(data)) {
      return respond(event, 400, { error: "Document data must be valid base64." }, {
        methods: DOCUMENT_METHODS,
      });
    }

    let decodedData;
    try {
      decodedData = Buffer.from(data, "base64");
    } catch {
      decodedData = null;
    }
    const size = decodedData?.length || 0;
    if (!Number.isFinite(size) || size <= 0) {
      return respond(event, 400, { error: "Document size is invalid." }, { methods: DOCUMENT_METHODS });
    }
    if (size > MAX_DOCUMENT_BYTES) {
      return respond(event, 413, { error: "Document exceeds the 10 MB upload limit." }, {
        methods: DOCUMENT_METHODS,
      });
    }
    if (!documentBytesMatchMimeType(decodedData, mimeType)) {
      return respond(event, 415, { error: "Document contents do not match the declared file type." }, {
        methods: DOCUMENT_METHODS,
      });
    }

    const result = await client.query(
      `INSERT INTO "document" ("organizationId", title, category, "fileName", "mimeType", size, data, source, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, title, category, "fileName", "mimeType", size, source, "createdAt"`,
      [organizationId, title, category, fileName, mimeType, size, data, source]
    );

    await writeAuditLog(client, {
      userId: authUser?.id,
      organizationId,
      action: "DOCUMENT_UPLOADED",
      targetType: "document",
      targetId: String(result.rows[0]?.id || ""),
      source: "api",
      category: "document",
      severity: "info",
      status: "ok",
      summary: `Uploaded document ${title}.`,
      actorLabel: authUser?.fullName || authUser?.email || null,
      requestId: getEventHeader(event, "x-request-id"),
      ipAddress: getEventIpAddress(event),
      metadata: {
        fileName,
        mimeType,
        size,
      },
    });

    return respond(event, 200, result.rows[0], { methods: DOCUMENT_METHODS });
  } catch (err) {
    console.error("❌ Document error:", err);
    return respond(event, 500, { error: "Failed to process documents." }, { methods: DOCUMENT_METHODS });
  } finally {
    await client.end().catch(() => {});
  }
}
