/* eslint-disable no-undef */
// Filename: inventory.js (Now serving ALL Products from the unified 'product' table)

import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  ensureAuditColumns,
  backfillAuditDefaults,
  findDefaultAdmin,
  resolveActor,
  normalizeActor,
} from "./auditHelpers.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { notifyManager } from "./_shared/managerPush.js";
import {
  backfillProductVendorLinksFromProducts,
  ensureProductVendorLinksTable,
  getProductVendorIdsMap,
  parseVendorIdsInput,
  setProductVendorLinks,
} from "./_shared/productVendors.js";
import { resolveOrganizationId } from "./_shared/organization.js";
import { requireUser } from "./_shared/userAuth.js";

const getCorsHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,POST,PATCH,DELETE,OPTIONS",
  }),
});

const allowedSources = ["CLOTHES", "TOYS", "RENTAL", "WATER"];
const statusColumnStatements = [
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT false`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "deletedByUserId" INTEGER`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER DEFAULT 2`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "reorderQuantity" INTEGER DEFAULT 0`,
];
const barcodeColumnStatements = [
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "barcode" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "product_barcode_org_unique"
    ON "product" ("organizationId", "barcode")`,
];
const vendorColumnStatements = [`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "vendorId" INTEGER`];
const inventoryEditRequestStatements = [
  `CREATE TABLE IF NOT EXISTS "inventoryEditRequest" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedFields" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "submittedByUserId" INTEGER,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "submittedByRole" TEXT,
    "reviewedByUserId" INTEGER,
    "reviewedByName" TEXT,
    "reviewedByEmail" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "productId" INTEGER`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'pending'`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "requestedFields" JSONB DEFAULT '{}'::jsonb`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "submittedByUserId" INTEGER`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "submittedByName" TEXT`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "submittedByEmail" TEXT`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "submittedByRole" TEXT`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "reviewedByUserId" INTEGER`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "reviewedByName" TEXT`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "reviewedByEmail" TEXT`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMPTZ`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "inventoryEditRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE INDEX IF NOT EXISTS "inventoryEditRequest_org_status_idx"
    ON "inventoryEditRequest" ("organizationId", "status", "createdAt")`,
];
const EDITABLE_FIELDS_BY_MANAGER = new Set(["name", "description", "priceCents", "stock"]);

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toCents = (value) => {
  const num = parseNumber(value, Number.NaN);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.round(Number.isInteger(num) ? num : num * 100));
};

const sanitizeString = (value, max = 120) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

const ensureSourceCategoryValue = async (client, value) => {
  try {
    const typeRes = await client.query(
      `SELECT t.typname AS enum_name
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_type t ON t.oid = a.atttypid
       WHERE c.relname = 'product'
         AND a.attname = 'sourceCategoryCode'
         AND t.typtype = 'e'
       LIMIT 1`
    );
    if (typeRes.rowCount === 0) return;
    const enumName = typeRes.rows[0]?.enum_name;
    if (!enumName) return;
    const existsRes = await client.query(
      `SELECT 1
       FROM pg_enum
       WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = $1)
         AND enumlabel = $2
       LIMIT 1`,
      [enumName, value]
    );
    if (existsRes.rowCount === 0) {
      await client.query(`ALTER TYPE "${enumName}" ADD VALUE '${value}'`);
    }
  } catch (err) {
    console.warn("Source category enum check failed:", err?.message || err);
  }
};

const ensureProductStatusColumns = async (client) => {
  for (const statement of statusColumnStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Product status column check failed:", err?.message || err);
    }
  }
};

const ensureProductBarcodeColumn = async (client) => {
  for (const statement of barcodeColumnStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Product barcode column check failed:", err?.message || err);
    }
  }
};

const ensureProductVendorColumn = async (client) => {
  for (const statement of vendorColumnStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Product vendor column check failed:", err?.message || err);
    }
  }
};

const ensureInventoryEditRequestTable = async (client) => {
  for (const statement of inventoryEditRequestStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Inventory edit request table check failed:", err?.message || err);
    }
  }
};

const isSystemAdmin = async (client, userId, organizationId = null) => {
  const parsedId = Number(userId);
  if (!Number.isFinite(parsedId)) return false;
  const hasOrg = Number.isFinite(Number(organizationId));
  const result = await client.query(
    `SELECT role FROM "user" WHERE id = $1${hasOrg ? ` AND "organizationId" = $2` : ""} LIMIT 1`,
    hasOrg ? [parsedId, organizationId] : [parsedId]
  );
  const role = result.rows[0]?.role || "";
  return role.toLowerCase() === "admin";
};

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const isAdminRole = (role) => normalizeRole(role) === "admin";

const canApproveInventoryEditRequests = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
};

const canEditInventoryDirectly = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
};

const canRequestInventoryEdit = (role) => normalizeRole(role) === "staff";

const buildActorFromUser = (user) => ({
  userId: user?.id ?? null,
  userName: user?.fullName || user?.email || "Admin",
  userEmail: user?.email || null,
});

const slugify = (value, max = 10) => {
  if (!value) return "ITEM";
  return value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, max) || "ITEM";
};

const generateSku = (name, source) => {
  const prefix = (source || "GEN").slice(0, 3).toUpperCase();
  const nameSlug = slugify(name, 8);
  const random = Math.random().toString(36).slice(-3).toUpperCase();
  return `${prefix}-${nameSlug}-${random}`;
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: getCorsHeaders(event), body: "" };
  }

  if (isCrossSiteBrowserRequest(event)) {
    return {
      statusCode: 403,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: "Cross-site requests are not allowed" }),
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL, // Railway Postgres URL
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    let payload = null;
    if (["PATCH", "DELETE", "POST"].includes(method)) {
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Invalid JSON body" }),
        };
      }
    }
    const authenticatedUser = await requireUser(client, event);
    const requestedView = (event.queryStringParameters?.view || "").toLowerCase();

    if (method === "GET" && !authenticatedUser) {
      if (requestedView && requestedView !== "default") {
        return {
          statusCode: 403,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Authentication is required for that inventory view." }),
        };
      }

      const organizationId = await resolveOrganizationId(client, event, null);
      const result = await client.query(
        `SELECT
           p.id,
           p.sku,
           p.name,
           p.description,
           p."sourceCategoryCode" AS "sourceCategoryCode",
           p."specificCategory" AS "specificCategory",
           p.rate,
           p.page,
           p.age,
           (p."price"::numeric / 100) AS price,
           p.stock AS quantity,
           p."imageUrl" AS image,
           p."imageUrl" AS "imageUrl",
           p."isActive" AS status,
           CASE
             WHEN COALESCE(p."isActive", true) = false THEN 'Unavailable'
             WHEN p.stock IS NOT NULL AND p.stock <= 0 THEN 'Unavailable'
             ELSE 'Available'
           END AS availability,
           p."attendantsNeeded" AS "attendantsNeeded",
           p.currency
         FROM "product" p
         WHERE p."organizationId" = $1
           AND COALESCE(p."isDeleted", false) = false
           AND COALESCE(p."isArchived", false) = false
         ORDER BY p.id ASC`,
        [organizationId]
      );

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(Array.isArray(result.rows) ? result.rows : []),
      };
    }

    if (!authenticatedUser) {
      return {
        statusCode: 401,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const organizationId = Number(authenticatedUser.organizationId);
    await ensureAuditColumns(client);
    await ensureProductStatusColumns(client);
    await ensureProductBarcodeColumn(client);
    await ensureProductVendorColumn(client);
    await ensureProductVendorLinksTable(client);
    await backfillProductVendorLinksFromProducts(client, organizationId);
    await ensureInventoryEditRequestTable(client);
    await ensureSourceCategoryValue(client, "WATER");
    const admin = await findDefaultAdmin(client, organizationId);
    if (admin?.id) {
      await backfillAuditDefaults(client, admin.id, organizationId);
    }

    if (method === "GET") {
      const view = requestedView;
      if (view === "edit-requests") {
        const authUser = authenticatedUser;
        if (!authUser || !canApproveInventoryEditRequests(authUser.role)) {
          return {
            statusCode: 403,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Only admins and managers can view edit approvals." }),
          };
        }

        const result = await client.query(
          `SELECT
             r.id,
             r."productId" AS "productId",
             r."requestedFields" AS "requestedFields",
             r."submittedByUserId" AS "submittedByUserId",
             r."submittedByName" AS "submittedByName",
             r."submittedByEmail" AS "submittedByEmail",
             r."submittedByRole" AS "submittedByRole",
             r."createdAt" AS "createdAt",
             p.name AS "productName",
             p.sku AS "productSku"
           FROM "inventoryEditRequest" r
           JOIN "product" p
             ON p.id = r."productId"
            AND p."organizationId" = r."organizationId"
           WHERE r."organizationId" = $1
             AND LOWER(COALESCE(r.status, 'pending')) = 'pending'
           ORDER BY r."createdAt" ASC`,
          [organizationId]
        );

        return {
          statusCode: 200,
          headers: getCorsHeaders(event),
          body: JSON.stringify(result.rows),
        };
      }

      let whereClause = `WHERE p."organizationId" = $1
        AND COALESCE(p."isDeleted", false) = false
        AND COALESCE(p."isArchived", false) = false`;
      if (view === "archived") {
        whereClause = `WHERE p."organizationId" = $1
          AND COALESCE(p."isArchived", false) = true
          AND COALESCE(p."isDeleted", false) = false`;
      } else if (view === "deleted") {
        whereClause = `WHERE p."organizationId" = $1
          AND COALESCE(p."isDeleted", false) = true`;
      }
      const result = await client.query(`
        SELECT 
          p.id,
          p.sku,
          p."barcode" AS "barcode",
          p.name, 
          p.description, 
          p."vendorId" AS "vendorId",
          p."sourceCategoryCode" AS "sourceCategoryCode",
          p."specificCategory"   AS "specificCategory",
          p.rate,
          p.page,
          p.age,
          (p."price"::numeric / 100) AS price,
          (p."purchasePriceGbp"::numeric / 100) AS "purchasePriceGbp",
          (p."purchasePriceGhs"::numeric / 100) AS "purchasePriceGhs",
          (p."purchasePriceCad"::numeric / 100) AS "purchasePriceCad",
          (p."stockValue"::numeric / 100) AS "stockValue",
          (p."saleValue"::numeric / 100) AS "saleValue",
          p.stock AS quantity,
          p."imageUrl" AS image,
          p."imageUrl" AS "imageUrl",
          p."isActive" AS status,
          CASE
            WHEN COALESCE(p."isActive", true) = false THEN 'Unavailable'
            WHEN p.stock IS NOT NULL AND p.stock <= 0 THEN 'Unavailable'
            ELSE 'Available'
          END AS availability,
          p."attendantsNeeded" AS "attendantsNeeded",
          p."isArchived" AS "isArchived",
          p."archivedAt" AS "archivedAt",
          p."isDeleted" AS "isDeleted",
          p."deletedAt" AS "deletedAt",
          p."reorderLevel" AS "reorderLevel",
          p."reorderQuantity" AS "reorderQuantity",
          p.currency,
          p."lastUpdatedAt",
          p."lastUpdatedByUserId",
          updater."fullName" AS "lastUpdatedByName",
          updater.email AS "lastUpdatedByEmail"
        FROM "product" p
        LEFT JOIN "user" updater ON updater.id = p."lastUpdatedByUserId"
        ${whereClause}
        ORDER BY p.id ASC
      `, [organizationId]);

      const rows = Array.isArray(result.rows) ? result.rows : [];
      const vendorIdsByProduct = await getProductVendorIdsMap(client, {
        organizationId,
        productIds: rows.map((row) => row.id),
      });
      const items = rows.map((row) => {
        const linkedVendorIds = vendorIdsByProduct.get(Number(row.id)) || [];
        const primaryVendorId = linkedVendorIds[0]
          ?? (Number.isFinite(Number(row.vendorId)) ? Number(row.vendorId) : null);
        return {
          ...row,
          vendorId: primaryVendorId,
          vendorIds: primaryVendorId && !linkedVendorIds.length ? [primaryVendorId] : linkedVendorIds,
        };
      });

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(items),
      };
    }

    if (method === "PATCH") {
      const action = String(payload.action || "").toLowerCase();
      if (action === "approve-edit-request" || action === "reject-edit-request") {
        const authUser = authenticatedUser;
        if (!authUser || !canApproveInventoryEditRequests(authUser.role)) {
          return {
            statusCode: 403,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Only admins and managers can review edit requests." }),
          };
        }

        const requestId = Number(payload.requestId);
        if (!Number.isFinite(requestId)) {
          return {
            statusCode: 400,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Request id is required." }),
          };
        }

        const reviewer = buildActorFromUser(authUser);

        if (action === "reject-edit-request") {
          const result = await client.query(
            `UPDATE "inventoryEditRequest"
             SET status = 'rejected',
                 "reviewedByUserId" = $2,
                 "reviewedByName" = $3,
                 "reviewedByEmail" = $4,
                 "reviewedAt" = NOW(),
                 "updatedAt" = NOW()
             WHERE id = $1
               AND "organizationId" = $5
               AND LOWER(COALESCE(status, 'pending')) = 'pending'
             RETURNING id, status`,
            [requestId, reviewer.userId, reviewer.userName, reviewer.userEmail, organizationId]
          );

          if (result.rowCount === 0) {
            return {
              statusCode: 404,
              headers: getCorsHeaders(event),
              body: JSON.stringify({ error: "Pending edit request not found." }),
            };
          }

          return {
            statusCode: 200,
            headers: getCorsHeaders(event),
            body: JSON.stringify(result.rows[0]),
          };
        }

        await client.query("BEGIN");
        try {
          const requestRes = await client.query(
            `SELECT
               r.id,
               r."productId" AS "productId",
               r."requestedFields" AS "requestedFields"
             FROM "inventoryEditRequest" r
             WHERE r.id = $1
               AND r."organizationId" = $2
               AND LOWER(COALESCE(r.status, 'pending')) = 'pending'
             FOR UPDATE`,
            [requestId, organizationId]
          );

          if (requestRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return {
              statusCode: 404,
              headers: getCorsHeaders(event),
              body: JSON.stringify({ error: "Pending edit request not found." }),
            };
          }

          const requestRow = requestRes.rows[0];
          const requestedFields =
            requestRow.requestedFields && typeof requestRow.requestedFields === "object"
              ? requestRow.requestedFields
              : {};

          const productRes = await client.query(
            `SELECT
               id,
               name,
               description,
               price,
               stock
             FROM "product"
             WHERE id = $1
               AND "organizationId" = $2
             LIMIT 1`,
            [requestRow.productId, organizationId]
          );

          if (productRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return {
              statusCode: 404,
              headers: getCorsHeaders(event),
              body: JSON.stringify({ error: "Product not found for this request." }),
            };
          }

          const currentProduct = productRes.rows[0];
          const nextName = Object.prototype.hasOwnProperty.call(requestedFields, "name")
            ? sanitizeString(requestedFields.name, 160) || currentProduct.name
            : currentProduct.name;
          const nextDescription = Object.prototype.hasOwnProperty.call(requestedFields, "description")
            ? sanitizeString(requestedFields.description || "", 400) || null
            : currentProduct.description;
          const nextPriceCents = Object.prototype.hasOwnProperty.call(requestedFields, "priceCents")
            ? Math.max(0, Math.round(parseNumber(requestedFields.priceCents)))
            : Number(currentProduct.price || 0);
          const nextStock = Object.prototype.hasOwnProperty.call(requestedFields, "stock")
            ? Math.max(0, Math.round(parseNumber(requestedFields.stock)))
            : Number(currentProduct.stock || 0);
          const nextStockValue = nextPriceCents * nextStock;

          const productUpdateRes = await client.query(
            `UPDATE "product"
             SET name = $2,
                 description = $3,
                 price = $4,
                 stock = $5,
                 "stockValue" = $6,
                 "lastUpdatedByUserId" = $7,
                 "lastUpdatedAt" = NOW(),
                 "updatedAt" = NOW()
             WHERE id = $1
               AND "organizationId" = $8
             RETURNING
               id,
               name,
               description,
               (price::numeric / 100) AS price,
               stock AS quantity,
               "lastUpdatedAt",
               "lastUpdatedByUserId"`,
            [
              requestRow.productId,
              nextName,
              nextDescription,
              nextPriceCents,
              nextStock,
              nextStockValue,
              reviewer.userId,
              organizationId,
            ]
          );

          await client.query(
            `UPDATE "inventoryEditRequest"
             SET status = 'approved',
                 "reviewedByUserId" = $2,
                 "reviewedByName" = $3,
                 "reviewedByEmail" = $4,
                 "reviewedAt" = NOW(),
                 "updatedAt" = NOW()
             WHERE id = $1`,
            [requestId, reviewer.userId, reviewer.userName, reviewer.userEmail]
          );

          await client.query("COMMIT");

          return {
            statusCode: 200,
            headers: getCorsHeaders(event),
            body: JSON.stringify({
              requestId,
              status: "approved",
              item: {
                ...productUpdateRes.rows[0],
                lastUpdatedByName: reviewer.userName,
                lastUpdatedByEmail: reviewer.userEmail,
              },
            }),
          };
        } catch (approvalError) {
          await client.query("ROLLBACK").catch(() => {});
          throw approvalError;
        }
      }

      const parsedId = Number(payload.id);
      if (!Number.isFinite(parsedId)) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Product id is required." }),
        };
      }

      const actor = await resolveActor(client, normalizeActor(payload), organizationId);
      if (action === "archive") {
        const result = await client.query(
          `UPDATE "product"
           SET "isArchived" = true,
               "isActive" = false,
               "archivedAt" = NOW(),
               "archivedByUserId" = $2,
               "lastUpdatedByUserId" = $2,
               "lastUpdatedAt" = NOW(),
               "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $3
           RETURNING id, sku, name, stock, "isArchived" AS "isArchived", "archivedAt" AS "archivedAt"`,
          [parsedId, actor.userId, organizationId]
        );
        return {
          statusCode: 200,
          headers: getCorsHeaders(event),
          body: JSON.stringify(result.rows[0] || {}),
        };
      }

      if (action === "unarchive") {
        const result = await client.query(
          `UPDATE "product"
           SET "isArchived" = false,
               "isActive" = true,
               "archivedAt" = NULL,
               "archivedByUserId" = NULL,
               "lastUpdatedByUserId" = $2,
               "lastUpdatedAt" = NOW(),
               "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $3
           RETURNING id, sku, name, stock, "isArchived" AS "isArchived"`,
          [parsedId, actor.userId, organizationId]
        );
        return {
          statusCode: 200,
          headers: getCorsHeaders(event),
          body: JSON.stringify(result.rows[0] || {}),
        };
      }

      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "Unsupported action." }),
      };
    }

    if (method === "DELETE") {
      const parsedId = Number(payload.id);
      if (!Number.isFinite(parsedId)) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Product id is required." }),
        };
      }

      const canDelete = await isSystemAdmin(client, payload.userId, organizationId);
      if (!canDelete) {
        return {
          statusCode: 403,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Only system admins can delete items." }),
        };
      }

      const actor = await resolveActor(client, normalizeActor(payload), organizationId);
      const result = await client.query(
        `UPDATE "product"
         SET "isDeleted" = true,
             "isArchived" = false,
             "isActive" = false,
             "deletedAt" = NOW(),
             "deletedByUserId" = $2,
             "archivedAt" = NULL,
             "archivedByUserId" = NULL,
             "lastUpdatedByUserId" = $2,
             "lastUpdatedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE id = $1 AND "organizationId" = $3
         RETURNING id, sku, name, stock, "deletedAt" AS "deletedAt"`,
        [parsedId, actor.userId, organizationId]
      );
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(result.rows[0] || {}),
      };
    }

    if (method !== "POST") {
      return {
        statusCode: 405,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const name = sanitizeString(payload.name, 160);
    const sourceCategoryCode = sanitizeString(
      payload.sourceCategoryCode || payload.sourcecategorycode || "",
      30
    ).toUpperCase();
    const specificCategory = sanitizeString(payload.specificCategory || payload.specificcategory || "", 120);
    const description = sanitizeString(payload.description || "", 400);
    const barcodeInput = sanitizeString(payload.barcode || payload.scanCode || "", 120);
    const barcode = barcodeInput || null;
    const currency = sanitizeString(payload.currency || "GHS", 8) || "GHS";
    const rate = sanitizeString(payload.rate || "", 80);
    const age = sanitizeString(payload.age || "", 80);
    const imageUrl = sanitizeString(payload.imageUrl || payload.image || "", 400);
    const attendantsNeededRaw = Number(payload.attendantsNeeded);
    const attendantsNeeded = Number.isFinite(attendantsNeededRaw)
      ? Math.max(0, Math.round(attendantsNeededRaw))
      : null;

    if (!name) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "Name is required." }),
      };
    }

    const safeSource = allowedSources.includes(sourceCategoryCode)
      ? sourceCategoryCode
      : "CLOTHES";

    const priceInput = payload.price ?? payload.priceCents ?? payload.price_cents;
    const priceValue = parseNumber(priceInput);
    const priceCents = Math.max(
      0,
      Math.round(Number.isInteger(priceValue) ? priceValue : priceValue * 100)
    );

    const stockInput = payload.stock ?? payload.quantity ?? 0;
    const stock = Math.max(0, Math.round(parseNumber(stockInput)));
    const purchasePriceGbpInput =
      payload.purchasePriceGbp ?? payload.purchasePriceGbpCents ?? payload.purchase_price_gbp;
    const purchasePriceGhsInput =
      payload.purchasePriceGhs ?? payload.purchasePriceGhsCents ?? payload.purchase_price_ghs;
    const purchasePriceCadInput =
      payload.purchasePriceCad ??
      payload.purchasePriceCadCents ??
      payload.purchase_price_gbp_from_cad;
    const purchasePriceGbp = toCents(purchasePriceGbpInput);
    const purchasePriceGhs = toCents(purchasePriceGhsInput);
    const purchasePriceCad = toCents(purchasePriceCadInput);
    const saleValueInput = payload.saleValue ?? payload.saleValueCents ?? payload.sale_value;
    const saleValue = toCents(saleValueInput);
    const parsedId = Number(payload.id);
    const reorderLevelRaw = Number(payload.reorderLevel ?? payload.reorder_level);
    const reorderQuantityRaw = Number(payload.reorderQuantity ?? payload.reorder_quantity);
    const hasVendorIdsInput = Object.prototype.hasOwnProperty.call(payload, "vendorIds");
    const hasVendorIdInput = Object.prototype.hasOwnProperty.call(payload, "vendorId");
    const hasVendorLinkInput = hasVendorIdsInput || hasVendorIdInput;
    const vendorLinkInput = hasVendorIdsInput
      ? payload.vendorIds
      : hasVendorIdInput
        ? [payload.vendorId]
        : undefined;
    const { vendorIds: requestedVendorIds, invalid: hasInvalidVendorIds } =
      parseVendorIdsInput(vendorLinkInput);
    const isUpdate = Number.isFinite(parsedId) && parsedId > 0;
    const reorderLevel = Number.isFinite(reorderLevelRaw)
      ? Math.max(0, Math.round(reorderLevelRaw))
      : isUpdate
        ? null
        : 2;
    const reorderQuantity = Number.isFinite(reorderQuantityRaw)
      ? Math.max(0, Math.round(reorderQuantityRaw))
      : isUpdate
        ? null
        : 0;

    const authUser = authenticatedUser;
    const actor = buildActorFromUser(authUser);
    const actorRole = normalizeRole(authUser?.role);

    // If updating an existing product, retain its SKU and current field values.
    let sku = null;
    let nextBarcode = barcode;
    let nextDescription = description || null;
    let nextSourceCategoryCode = safeSource;
    let nextSpecificCategory = specificCategory || null;
    let nextRate = rate || null;
    let nextAge = age || null;
    let nextPriceCents = priceCents;
    let nextCurrency = currency;
    let nextStock = stock;
    let nextPurchasePriceGbp = purchasePriceGbp;
    let nextPurchasePriceGhs = purchasePriceGhs;
    let nextPurchasePriceCad = purchasePriceCad;
    let nextSaleValue = saleValue;
    let nextAttendantsNeeded = attendantsNeeded;
    let nextImageUrl = imageUrl || null;
    let nextVendorIds = hasVendorLinkInput ? requestedVendorIds : [];
    let nextReorderLevel = reorderLevel;
    let nextReorderQuantity = reorderQuantity;

    if (hasVendorLinkInput && hasInvalidVendorIds) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "Each vendor must be empty or a valid vendor id." }),
      };
    }

    if (isUpdate) {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Unauthorized" }),
        };
      }

      const existing = await client.query(
        `SELECT
           id,
           sku,
           barcode,
           name,
           description,
           "vendorId",
           "sourceCategoryCode",
           "specificCategory",
           rate,
           age,
           price,
           currency,
           stock,
           "purchasePriceGbp",
           "purchasePriceGhs",
           "purchasePriceCad",
           "saleValue",
           "attendantsNeeded",
           "imageUrl",
           "reorderLevel",
           "reorderQuantity"
         FROM "product"
         WHERE id = $1 AND "organizationId" = $2
         LIMIT 1`,
        [parsedId, organizationId]
      );
      if (existing.rowCount === 0) {
        return {
          statusCode: 404,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: `Product with id ${parsedId} not found.` }),
        };
      }

      const currentProduct = existing.rows[0];
      const currentVendorLinkMap = await getProductVendorIdsMap(client, {
        organizationId,
        productIds: [parsedId],
      });
      const currentVendorIds = currentVendorLinkMap.get(parsedId)
        || (
          Number.isFinite(Number(currentProduct.vendorId))
            ? [Number(currentProduct.vendorId)]
            : []
        );
      sku = currentProduct.sku;
      nextVendorIds = hasVendorLinkInput ? requestedVendorIds : currentVendorIds;

      if (!canEditInventoryDirectly(actorRole) && !canRequestInventoryEdit(actorRole)) {
        return {
          statusCode: 403,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "You do not have permission to edit inventory items." }),
        };
      }

      if (canRequestInventoryEdit(actorRole)) {
        const requestedFields = {};
        if (name !== currentProduct.name) requestedFields.name = name;
        if (nextDescription !== (currentProduct.description || null)) {
          requestedFields.description = nextDescription;
        }
        if (nextPriceCents !== Number(currentProduct.price || 0)) {
          requestedFields.priceCents = nextPriceCents;
        }
        if (nextStock !== Number(currentProduct.stock || 0)) {
          requestedFields.stock = nextStock;
        }

        const changedFieldKeys = Object.keys(requestedFields).filter((field) =>
          EDITABLE_FIELDS_BY_MANAGER.has(field)
        );
        if (!changedFieldKeys.length) {
          return {
            statusCode: 400,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "No editable changes were submitted." }),
          };
        }

        const requestResult = await client.query(
          `INSERT INTO "inventoryEditRequest" (
             "organizationId",
             "productId",
             "status",
             "requestedFields",
             "submittedByUserId",
             "submittedByName",
             "submittedByEmail",
             "submittedByRole",
             "createdAt",
             "updatedAt"
           )
           VALUES ($1, $2, 'pending', $3::jsonb, $4, $5, $6, $7, NOW(), NOW())
           RETURNING
             id,
             "productId" AS "productId",
             "requestedFields" AS "requestedFields",
             "submittedByName" AS "submittedByName",
             "submittedByEmail" AS "submittedByEmail",
             "submittedByRole" AS "submittedByRole",
             "createdAt" AS "createdAt"`,
          [
            organizationId,
            parsedId,
            JSON.stringify(requestedFields),
            actor.userId,
            actor.userName,
            actor.userEmail,
            actorRole || "staff",
          ]
        );

        try {
          await notifyManager(client, {
            title: "Inventory edit approval",
            body: `${actor.userName || "Staff"} requested changes for ${currentProduct.name || `Item #${parsedId}`}.`,
            data: {
              type: "inventory-edit-request",
              requestId: requestResult.rows[0]?.id,
              productId: parsedId,
            },
          });
        } catch (notifyError) {
          console.warn("Inventory edit approval notification failed:", notifyError?.message || notifyError);
        }

        return {
          statusCode: 202,
          headers: getCorsHeaders(event),
          body: JSON.stringify({
            status: "pending_approval",
            message: "Changes sent for manager approval.",
            request: requestResult.rows[0],
          }),
        };
      }

      if (!isAdminRole(actorRole)) {
        nextBarcode = currentProduct.barcode;
        nextSourceCategoryCode = currentProduct.sourceCategoryCode || nextSourceCategoryCode;
        nextSpecificCategory = currentProduct.specificCategory || null;
        nextRate = currentProduct.rate || null;
        nextAge = currentProduct.age || null;
        nextCurrency = currentProduct.currency || nextCurrency;
        nextPurchasePriceGbp = currentProduct.purchasePriceGbp;
        nextPurchasePriceGhs = currentProduct.purchasePriceGhs;
        nextPurchasePriceCad = currentProduct.purchasePriceCad;
        nextSaleValue = currentProduct.saleValue;
        nextAttendantsNeeded = currentProduct.attendantsNeeded;
        nextImageUrl = currentProduct.imageUrl || null;
        nextVendorIds = currentVendorIds;
        nextReorderLevel = currentProduct.reorderLevel;
        nextReorderQuantity = currentProduct.reorderQuantity;
      }
    } else {
      sku = generateSku(name, safeSource);
    }

    const nextVendorId = nextVendorIds[0] || null;
    const stockValue = nextPriceCents * nextStock;

    const insertQuery = `
      INSERT INTO "product" (
        "organizationId",
        "sku",
        "barcode",
        "name",
        "description",
        "vendorId",
        "sourceCategoryCode",
        "specificCategory",
        "rate",
        "age",
        "price",
        "currency",
        "stock",
        "purchasePriceGbp",
        "purchasePriceGhs",
        "purchasePriceCad",
        "stockValue",
        "saleValue",
        "attendantsNeeded",
        "imageUrl",
        "reorderLevel",
        "reorderQuantity",
        "isActive",
        "lastUpdatedByUserId",
        "lastUpdatedAt",
        "createdAt",
        "updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,true,$23,NOW(),NOW(),NOW())
      ON CONFLICT ("organizationId", "sku") DO UPDATE
      SET "barcode" = EXCLUDED."barcode",
          "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "vendorId" = EXCLUDED."vendorId",
          "sourceCategoryCode" = EXCLUDED."sourceCategoryCode",
          "specificCategory" = EXCLUDED."specificCategory",
          "rate" = EXCLUDED."rate",
          "age" = EXCLUDED."age",
          "price" = EXCLUDED."price",
          "currency" = EXCLUDED."currency",
          "stock" = EXCLUDED."stock",
          "purchasePriceGbp" = COALESCE(EXCLUDED."purchasePriceGbp", "product"."purchasePriceGbp"),
          "purchasePriceGhs" = COALESCE(EXCLUDED."purchasePriceGhs", "product"."purchasePriceGhs"),
          "purchasePriceCad" = COALESCE(EXCLUDED."purchasePriceCad", "product"."purchasePriceCad"),
          "stockValue" = COALESCE(EXCLUDED."stockValue", "product"."stockValue"),
          "saleValue" = COALESCE(EXCLUDED."saleValue", "product"."saleValue"),
          "attendantsNeeded" = COALESCE(EXCLUDED."attendantsNeeded", "product"."attendantsNeeded"),
          "imageUrl" = COALESCE(EXCLUDED."imageUrl", "product"."imageUrl"),
          "reorderLevel" = COALESCE(EXCLUDED."reorderLevel", "product"."reorderLevel"),
          "reorderQuantity" = COALESCE(EXCLUDED."reorderQuantity", "product"."reorderQuantity"),
          "isActive" = true,
          "lastUpdatedByUserId" = EXCLUDED."lastUpdatedByUserId",
          "lastUpdatedAt" = NOW(),
          "updatedAt" = NOW()
      RETURNING 
        id,
        sku,
        barcode,
        name,
        description,
        "vendorId" AS "vendorId",
        "sourceCategoryCode",
        "specificCategory",
        rate,
        age,
        (price::numeric / 100) AS price,
        ("purchasePriceGbp"::numeric / 100) AS "purchasePriceGbp",
        ("purchasePriceGhs"::numeric / 100) AS "purchasePriceGhs",
        ("purchasePriceCad"::numeric / 100) AS "purchasePriceCad",
        ("stockValue"::numeric / 100) AS "stockValue",
        ("saleValue"::numeric / 100) AS "saleValue",
        stock AS quantity,
        "imageUrl" AS image,
        "imageUrl" AS "imageUrl",
        "attendantsNeeded" AS "attendantsNeeded",
        "reorderLevel",
        "reorderQuantity",
        "isActive" AS status,
        CASE
          WHEN COALESCE("isActive", true) = false THEN 'Unavailable'
          WHEN stock IS NOT NULL AND stock <= 0 THEN 'Unavailable'
          ELSE 'Available'
        END AS availability,
        currency,
        "lastUpdatedAt",
        "lastUpdatedByUserId"
    `;

    const result = await client.query(insertQuery, [
      organizationId,
      sku,
      nextBarcode,
      name,
      nextDescription,
      nextVendorId,
      nextSourceCategoryCode,
      nextSpecificCategory,
      nextRate,
      nextAge,
      nextPriceCents,
      nextCurrency,
      nextStock,
      nextPurchasePriceGbp,
      nextPurchasePriceGhs,
      nextPurchasePriceCad,
      stockValue,
      nextSaleValue,
      nextAttendantsNeeded,
      nextImageUrl,
      nextReorderLevel,
      nextReorderQuantity,
      actor.userId,
    ]);

    const created = result.rows[0];
    const syncedVendorIds = await setProductVendorLinks(client, {
      organizationId,
      productId: created?.id,
      vendorIds: nextVendorIds,
    });
    return {
      statusCode: isUpdate ? 200 : 201,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        ...created,
        vendorId: syncedVendorIds[0] || null,
        vendorIds: syncedVendorIds,
        lastUpdatedByName: actor.userName,
        lastUpdatedByEmail: actor.userEmail,
      }),
    };
  } catch (err) {
    console.error("❌ Database error:", err);

    const isUniqueViolation = err?.code === "23505";
    const detail = err?.detail || err?.message || null;
    return {
      statusCode: isUniqueViolation ? 409 : 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: isUniqueViolation ? "A product with that SKU or barcode already exists." : "Failed to process request.",
        detail,
        code: err?.code || null,
      }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
