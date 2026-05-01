/* eslint-disable no-undef */
// Filename: inventory.js (Now serving ALL Products from the unified 'product' table)

import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { ensureAuditColumns } from "./auditHelpers.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { notifyManager } from "./_shared/managerPush.js";
import {
  ensureProductVendorLinksTable,
  getProductVendorIdsMap,
  parseVendorIdsInput,
  setProductVendorLinks,
} from "./_shared/productVendors.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import { requireInternalUser } from "./_shared/internalApi.js";
import { requireUser } from "./_shared/userAuth.js";
import {
  cleanInventoryText,
  createSourceCategory,
  createSpecificCategory,
  ensureInventoryVariantSchema,
  findSourceCategoryById,
  findSourceCategoryByName,
  normalizeInventoryItemType,
  seedDefaultSourceCategories,
} from "./_shared/inventoryExtensions.js";

const getCorsHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,POST,PATCH,DELETE,OPTIONS",
  }),
});

const DEFAULT_SOURCE_CATEGORY_CODE = "INVENTORY";
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
const inventoryAuditColumnStatements = [
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "lastUpdatedByUserId" INTEGER`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "lastUpdatedAt" TIMESTAMPTZ DEFAULT NOW()`,
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

let hasEnsuredInventoryReadSchema = false;
let inventoryReadSchemaPromise = null;
let hasEnsuredInventoryWriteSchema = false;
let inventoryWriteSchemaPromise = null;

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const ensureInventoryReadSchema = async (client) => {
  if (hasEnsuredInventoryReadSchema) return;

  if (!inventoryReadSchemaPromise) {
    inventoryReadSchemaPromise = (async () => {
      for (const statement of inventoryAuditColumnStatements) {
        try {
          await client.query(statement);
        } catch (err) {
          console.warn("Inventory audit column check failed:", err?.message || err);
        }
      }
      await ensureProductStatusColumns(client);
      await ensureProductBarcodeColumn(client);
      await ensureProductVendorColumn(client);
      await ensureProductVendorLinksTable(client);
      await ensureInventoryVariantSchema(client);
      hasEnsuredInventoryReadSchema = true;
    })().finally(() => {
      inventoryReadSchemaPromise = null;
    });
  }

  await inventoryReadSchemaPromise;
};

const ensureInventoryWriteSchema = async (client) => {
  await ensureInventoryReadSchema(client);
  if (hasEnsuredInventoryWriteSchema) return;

  if (!inventoryWriteSchemaPromise) {
    inventoryWriteSchemaPromise = (async () => {
      await ensureAuditColumns(client);
      await ensureInventoryEditRequestTable(client);
      await ensureSourceCategoryValue(client, "WATER");
      await ensureInventoryVariantSchema(client);
      hasEnsuredInventoryWriteSchema = true;
    })().finally(() => {
      inventoryWriteSchemaPromise = null;
    });
  }

  await inventoryWriteSchemaPromise;
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

const normalizeCategoryName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/gi, (match) => match.toUpperCase());

const normalizeSourceCategoryCodeValue = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const getPayloadProductId = (payload = {}) =>
  payload.sourceCategoryId ?? payload.source_category_id
    ?? payload.inventoryProductId ?? payload.inventory_product_id
    ?? payload.productGroupId ?? payload.product_group_id;

const getPayloadProductName = (payload = {}) =>
  payload.sourceCategoryName ?? payload.source_category_name
    ?? payload.inventoryProductName ?? payload.inventory_product_name
    ?? payload.productGroupName ?? payload.product_group_name;

const getPayloadProductCode = (payload = {}) =>
  payload.sourceCategoryCode ?? payload.source_category_code ?? payload.sourcecategorycode
    ?? payload.inventoryProductCode ?? payload.inventory_product_code
    ?? payload.productGroupCode ?? payload.product_group_code;

const getPayloadCategoryName = (payload = {}) =>
  payload.specificCategory ?? payload.specificcategory ?? payload.specific_category
    ?? payload.category ?? payload.inventoryCategory ?? payload.inventory_category;

const hasPayloadCategoryInput = (payload = {}) =>
  [
    "specificCategory",
    "specificcategory",
    "specific_category",
    "category",
    "inventoryCategory",
    "inventory_category",
  ].some((key) => hasOwn(payload, key));

const withInventoryAliases = (item = {}) => {
  const productId =
    item.inventoryProductId ?? item.inventory_product_id ?? item.productGroupId ?? item.product_group_id
    ?? item.sourceCategoryId ?? item.source_category_id ?? null;

  const productName =
    item.inventoryProductName ?? item.inventory_product_name ?? item.productGroupName ?? item.product_group_name
    ?? item.productName ?? item.product_name ?? item.sourceCategoryName ?? item.source_category_name ?? null;

  const productCode =
    item.inventoryProductCode ?? item.inventory_product_code ?? item.productGroupCode ?? item.product_group_code
    ?? item.productCode ?? item.product_code ?? item.sourceCategoryCode ?? item.sourcecategorycode
    ?? item.source_category_code ?? null;

  const sourceCategory =
    item.sourceCategory
    ?? item.sourcecategory
    ?? item.source_category
    ?? item.sourceCategoryName
    ?? item.source_category_name
    ?? null;

  const category =
    item.category ?? item.inventoryCategory ?? item.inventory_category ?? item.specificCategory
    ?? item.specificcategory ?? item.specific_category ?? null;

  return {
    ...item,
    inventoryProductId: productId,
    inventoryProductName: productName,
    inventoryProductCode: productCode,
    productGroupId: productId,
    productGroupName: productName,
    productGroupCode: productCode,

    sourceCategory,
    sourcecategory: sourceCategory,
    source_category: sourceCategory,

    category,
    inventoryCategory: category,
  };
};

const INVENTORY_IMAGE_FALLBACK_SQL = `COALESCE(
  NULLIF(p."imageUrl", ''),
  NULLIF(si.image, ''),
  NULLIF(m.image, ''),
  NULLIF(ig.image, ''),
  NULLIF(bc.image, ''),
  NULLIF(bc.images[1], '')
)`;

const INVENTORY_IMAGE_FALLBACK_JOINS = `
  LEFT JOIN "shop_items" si
    ON si."productId" = p.id
   AND si."organizationId" = p."organizationId"
  LEFT JOIN "machines" m
    ON m."productId" = p.id
   AND m."organizationId" = p."organizationId"
  LEFT JOIN "indoor_games" ig
    ON ig."productId" = p.id
   AND ig."organizationId" = p."organizationId"
  LEFT JOIN "bouncy_castles" bc
    ON bc."productId" = p.id
   AND bc."organizationId" = p."organizationId"
`;

const resolveSourceCategoryForSpecificCategory = (_value, fallbackSourceCode = "") => ({
  sourceName: "",
  sourceCode: normalizeSourceCategoryCodeValue(fallbackSourceCode) || DEFAULT_SOURCE_CATEGORY_CODE,
  matched: false,
});

const resolveSourceCategoryCodeForCategory = (category) => {
  return normalizeSourceCategoryCodeValue(
    category?.sourceCategoryCode || category?.slug || category?.name
  ) || DEFAULT_SOURCE_CATEGORY_CODE;
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
    console.warn("Product enum check failed:", err?.message || err);
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
  return ["owner", "admin"].includes(role.toLowerCase());
};

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const isAdminRole = (role) => ["owner", "admin"].includes(normalizeRole(role));

const canApproveInventoryEditRequests = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "manager";
};

const canEditInventoryDirectly = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "manager";
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

const recordInventoryStockAdjustment = async (
  client,
  {
    organizationId,
    productId,
    previousStock,
    nextStock,
    actor,
    reference = "Inventory edit",
  }
) => {
  const before = Number(previousStock);
  const after = Number(nextStock);
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) return;

  const delta = after - before;
  const type = delta > 0 ? "StockIn" : "StockOut";
  const quantity = Math.abs(delta);

  await client.query(
    `INSERT INTO "stockMovement" (
       "organizationId",
       "productId",
       "type",
       "quantity",
       "notes",
       "reference",
       "date",
       "performedByUserId",
       "performedByName",
       "performedByEmail",
       "createdAt"
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, NOW())`,
    [
      organizationId,
      productId,
      type,
      quantity,
      `${type === "StockIn" ? "Increased" : "Reduced"} by inventory edit (${before} -> ${after})`,
      reference,
      actor?.userId || null,
      actor?.userName || "Admin",
      actor?.userEmail || null,
    ]
  );
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
    const previewUser = await requireUser(client, event);
    const requestedView = (event.queryStringParameters?.view || "").toLowerCase();

    if (method === "GET" && !previewUser) {
      if (requestedView && requestedView !== "default") {
        return {
          statusCode: 403,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Authentication is required for that inventory view." }),
        };
      }

      // Intentionally public: storefront inventory reads for the configured public organization only.
      const organizationId = await resolveConfiguredPublicOrganizationId(client);
      await applyRequestOrganizationContext(client, organizationId);
      await ensureInventoryReadSchema(client);
      await seedDefaultSourceCategories(client, organizationId);
      const result = await client.query(
        `SELECT
           p.id,
           p.sku,
           p.name,
           p.description,
           p."itemType" AS "itemType",
           p."sourceCategoryId" AS "sourceCategoryId",
           sc.name AS "sourceCategoryName",
           sc.slug AS "sourceCategorySlug",
           p."sourceCategoryCode" AS "sourceCategoryCode",
           p."specificCategory" AS "specificCategory",
           p.rate,
           p.page,
           p.age,
           (p."price"::numeric / 100) AS price,
           p.stock AS quantity,
           ${INVENTORY_IMAGE_FALLBACK_SQL} AS image,
           ${INVENTORY_IMAGE_FALLBACK_SQL} AS "imageUrl",
           p."isActive" AS status,
           CASE
             WHEN COALESCE(p."isActive", true) = false THEN 'Unavailable'
             WHEN UPPER(COALESCE(p."sourceCategoryCode", '')) = 'RENTAL' THEN 'Available'
             WHEN p.stock IS NOT NULL AND p.stock <= 0 THEN 'Unavailable'
             ELSE 'Available'
           END AS availability,
           p."attendantsNeeded" AS "attendantsNeeded",
           p.currency,
           COALESCE((
             SELECT json_agg(
               json_build_object(
                 'id', v.id,
                 'inventoryItemId', v."inventoryItemId",
                 'sku', v.sku,
                 'variantName', v."variantName",
                 'variantNumber', v."variantNumber",
                 'color', v.color,
                 'size', v.size,
                 'stockQty', v."stockQty",
                 'reservedQty', v."reservedQty",
                 'availableQty', GREATEST(v."stockQty" - v."reservedQty", 0),
                 'reorderLevel', v."reorderLevel",
                 'priceOverride', CASE WHEN v."priceOverride" IS NULL THEN NULL ELSE (v."priceOverride"::numeric / 100) END,
                 'status', v.status
               )
               ORDER BY v.id
             )
             FROM "inventoryVariant" v
             WHERE v."organizationId" = p."organizationId"
               AND v."inventoryItemId" = p.id
           ), '[]'::json) AS variants
         FROM "product" p
         ${INVENTORY_IMAGE_FALLBACK_JOINS}
         LEFT JOIN "sourceCategory" sc
           ON sc.id = p."sourceCategoryId"
          AND sc."organizationId" = p."organizationId"
         WHERE p."organizationId" = $1
           AND COALESCE(p."isDeleted", false) = false
           AND COALESCE(p."isArchived", false) = false
         ORDER BY p.id ASC`,
        [organizationId]
      );

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify((Array.isArray(result.rows) ? result.rows : []).map(withInventoryAliases)),
      };
    }

    if (!previewUser) {
      return {
        statusCode: 401,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const access = await requireInternalUser(client, event, {
      methods: "GET,POST,PATCH,DELETE,OPTIONS",
      body: payload,
    });
    if (access.errorResponse) {
      return access.errorResponse;
    }
    const { authUser: authenticatedUser, organizationId } = access;
    const needsWriteSchema = method !== "GET" || requestedView === "edit-requests";
    if (needsWriteSchema) {
      await ensureInventoryWriteSchema(client);
    } else {
      await ensureInventoryReadSchema(client);
    }
    await seedDefaultSourceCategories(client, organizationId);

    if (
      method !== "GET" &&
      !(
        canApproveInventoryEditRequests(authenticatedUser.role) ||
        canEditInventoryDirectly(authenticatedUser.role) ||
        canRequestInventoryEdit(authenticatedUser.role)
      )
    ) {
      return {
        statusCode: 403,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "You do not have permission to edit inventory." }),
      };
    }

    if (method === "GET") {
      const view = requestedView;

      // Single-item lookup: GET /inventory?id=123
      const singleId = event.queryStringParameters?.id
        ? Number(event.queryStringParameters.id)
        : null;
      if (singleId && Number.isFinite(singleId)) {
        const singleResult = await client.query(`
          SELECT
            p.id,
            p.sku,
            p."barcode" AS "barcode",
            p.name,
            p.description,
            p."vendorId" AS "vendorId",
            p."itemType" AS "itemType",
            p."sourceCategoryId" AS "sourceCategoryId",
            sc.name AS "sourceCategoryName",
            sc.slug AS "sourceCategorySlug",
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
            ${INVENTORY_IMAGE_FALLBACK_SQL} AS image,
            ${INVENTORY_IMAGE_FALLBACK_SQL} AS "imageUrl",
            p."isActive" AS status,
            CASE
              WHEN COALESCE(p."isActive", true) = false THEN 'Unavailable'
              WHEN UPPER(COALESCE(p."sourceCategoryCode", '')) = 'RENTAL' THEN 'Available'
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
            updater.email AS "lastUpdatedByEmail",
            COALESCE((
              SELECT json_agg(
                json_build_object(
                  'id', v.id,
                  'inventoryItemId', v."inventoryItemId",
                  'sku', v.sku,
                  'variantName', v."variantName",
                  'variantNumber', v."variantNumber",
                  'color', v.color,
                  'size', v.size,
                  'stockQty', v."stockQty",
                  'reservedQty', v."reservedQty",
                  'availableQty', GREATEST(v."stockQty" - v."reservedQty", 0),
                  'reorderLevel', v."reorderLevel",
                  'priceOverride', CASE WHEN v."priceOverride" IS NULL THEN NULL ELSE (v."priceOverride"::numeric / 100) END,
                  'status', v.status
                )
                ORDER BY v.id
              )
              FROM "inventoryVariant" v
              WHERE v."organizationId" = p."organizationId"
                AND v."inventoryItemId" = p.id
            ), '[]'::json) AS variants
          FROM "product" p
          LEFT JOIN "user" updater ON updater.id = p."lastUpdatedByUserId"
          ${INVENTORY_IMAGE_FALLBACK_JOINS}
          LEFT JOIN "sourceCategory" sc
            ON sc.id = p."sourceCategoryId"
           AND sc."organizationId" = p."organizationId"
          WHERE p.id = $1
            AND p."organizationId" = $2
            AND COALESCE(p."isDeleted", false) = false
        `, [singleId, organizationId]);

        if (singleResult.rowCount === 0) {
          return {
            statusCode: 404,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Item not found." }),
          };
        }

        const singleRow = singleResult.rows[0];
        const vendorMap = await getProductVendorIdsMap(client, {
          organizationId,
          productIds: [singleRow.id],
        });
        const linkedVendorIds = vendorMap.get(Number(singleRow.id)) || [];
        const primaryVendorId = linkedVendorIds[0]
          ?? (Number.isFinite(Number(singleRow.vendorId)) ? Number(singleRow.vendorId) : null);
        return {
          statusCode: 200,
          headers: getCorsHeaders(event),
          body: JSON.stringify(withInventoryAliases({
            ...singleRow,
            vendorId: primaryVendorId,
            vendorIds: primaryVendorId && !linkedVendorIds.length ? [primaryVendorId] : linkedVendorIds,
          })),
        };
      }

      if (view === "edit-requests") {
        const authUser = authenticatedUser;
        if (!authUser || !canApproveInventoryEditRequests(authUser.role)) {
          return {
            statusCode: 403,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Only owners, admins, and managers can view edit approvals." }),
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
          p."itemType" AS "itemType",
          p."sourceCategoryId" AS "sourceCategoryId",
          sc.name AS "sourceCategoryName",
          sc.slug AS "sourceCategorySlug",
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
          ${INVENTORY_IMAGE_FALLBACK_SQL} AS image,
          ${INVENTORY_IMAGE_FALLBACK_SQL} AS "imageUrl",
          p."isActive" AS status,
          CASE
            WHEN COALESCE(p."isActive", true) = false THEN 'Unavailable'
            WHEN UPPER(COALESCE(p."sourceCategoryCode", '')) = 'RENTAL' THEN 'Available'
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
          updater.email AS "lastUpdatedByEmail",
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', v.id,
                'inventoryItemId', v."inventoryItemId",
                'sku', v.sku,
                'variantName', v."variantName",
                'variantNumber', v."variantNumber",
                'color', v.color,
                'size', v.size,
                'stockQty', v."stockQty",
                'reservedQty', v."reservedQty",
                'availableQty', GREATEST(v."stockQty" - v."reservedQty", 0),
                'reorderLevel', v."reorderLevel",
                'priceOverride', CASE WHEN v."priceOverride" IS NULL THEN NULL ELSE (v."priceOverride"::numeric / 100) END,
                'status', v.status
              )
              ORDER BY v.id
            )
            FROM "inventoryVariant" v
            WHERE v."organizationId" = p."organizationId"
              AND v."inventoryItemId" = p.id
          ), '[]'::json) AS variants
        FROM "product" p
        LEFT JOIN "user" updater ON updater.id = p."lastUpdatedByUserId"
        ${INVENTORY_IMAGE_FALLBACK_JOINS}
        LEFT JOIN "sourceCategory" sc
          ON sc.id = p."sourceCategoryId"
         AND sc."organizationId" = p."organizationId"
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
        return withInventoryAliases({
          ...row,
          vendorId: primaryVendorId,
          vendorIds: primaryVendorId && !linkedVendorIds.length ? [primaryVendorId] : linkedVendorIds,
        });
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
            body: JSON.stringify({ error: "Only owners, admins, and managers can review edit requests." }),
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
               "itemType",
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
          if (
            normalizeInventoryItemType(currentProduct.itemType) === "VARIANT_PARENT"
            && nextStock !== Number(currentProduct.stock || 0)
          ) {
            await client.query("ROLLBACK");
            return {
              statusCode: 400,
              headers: getCorsHeaders(event),
              body: JSON.stringify({ error: "Adjust variant stock from the variant table." }),
            };
          }
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

          await recordInventoryStockAdjustment(client, {
            organizationId,
            productId: requestRow.productId,
            previousStock: currentProduct.stock,
            nextStock,
            actor: reviewer,
            reference: `Inventory edit request #${requestId}`,
          });

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

      const actor = buildActorFromUser(authenticatedUser);
      if (action === "archive") {
        if (!isAdminRole(authenticatedUser.role)) {
          return {
            statusCode: 403,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Only owners and admins can archive inventory items." }),
          };
        }
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
        if (!isAdminRole(authenticatedUser.role)) {
          return {
            statusCode: 403,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Only owners and admins can restore archived inventory items." }),
          };
        }
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

      const canDelete = await isSystemAdmin(client, authenticatedUser.id, organizationId);
      if (!canDelete) {
        return {
          statusCode: 403,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Only owners and admins can delete items." }),
        };
      }

      const actor = buildActorFromUser(authenticatedUser);

      // Block deletion if the item has active (pending/confirmed) bookings or open orders.
      const activeBookingCheck = await client.query(
        `SELECT 1 FROM "bookingItem" bi
         JOIN "booking" b ON b.id = bi."bookingId"
         WHERE bi."productId" = $1
           AND bi."organizationId" = $2
           AND LOWER(b.status) IN ('pending', 'confirmed')
         LIMIT 1`,
        [parsedId, organizationId]
      );
      if (activeBookingCheck.rowCount > 0) {
        return {
          statusCode: 409,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Cannot delete this item — it has active bookings. Cancel or complete all bookings first." }),
        };
      }

      const activeOrderCheck = await client.query(
        `SELECT 1 FROM "orderItem" oi
         JOIN "order" o ON o.id = oi."orderId"
         WHERE oi."productId" = $1
           AND oi."organizationId" = $2
           AND LOWER(o.status) NOT IN ('cancelled', 'canceled', 'completed', 'delivered')
         LIMIT 1`,
        [parsedId, organizationId]
      );
      if (activeOrderCheck.rowCount > 0) {
        return {
          statusCode: 409,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Cannot delete this item — it has open orders. Close all orders first." }),
        };
      }

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

    const postAction = String(payload.action || "").trim().toLowerCase();
    if (postAction === "reassign-categories") {
      const authUser = authenticatedUser;
      if (!authUser || !isAdminRole(authUser.role)) {
        return {
          statusCode: 410,
          headers: getCorsHeaders(event),
          body: JSON.stringify({
            error: "Category reassignment actions have been retired.",
        }),
        };

      }

      const productIds = Array.isArray(payload.productIds)
        ? payload.productIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
        : [];

      if (!productIds.length) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Select at least one inventory item." }),
        };
      }

      const hasSourceCategoryInput = Boolean(
        getPayloadProductId(payload)
        || sanitizeString(getPayloadProductName(payload) || "", 120)
      );
      const hasSpecificCategoryInput = hasPayloadCategoryInput(payload);
      const specificCategory = hasSpecificCategoryInput
        ? normalizeCategoryName(
          sanitizeString(getPayloadCategoryName(payload) || "", 120)
        )
        : null;

      if (!hasSourceCategoryInput && !specificCategory) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Choose a product, a category, or both." }),
        };
      }

      if (hasSpecificCategoryInput && !specificCategory) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Category cannot be blank." }),
        };
      }

      let sourceCategory = null;
      let sourceCategoryCode = null;
      if (hasSourceCategoryInput) {
        sourceCategory = await findSourceCategoryById(client, organizationId, getPayloadProductId(payload));
        const sourceCategoryName = sanitizeString(
          getPayloadProductName(payload) || "",
          120
        );
        if (!sourceCategory && sourceCategoryName) {
          sourceCategory = await findSourceCategoryByName(client, organizationId, sourceCategoryName);
        }
        if (!sourceCategory && payload.createIfMissing && sourceCategoryName) {
          sourceCategory = await createSourceCategory(client, organizationId, sourceCategoryName);
        }
        if (!sourceCategory) {
          return {
            statusCode: 400,
            headers: getCorsHeaders(event),
            body: JSON.stringify({ error: "Choose a valid product." }),
          };
        }
        const requestedSourceCategoryCode = normalizeSourceCategoryCodeValue(
          getPayloadProductCode(payload)
        );
        sourceCategoryCode = requestedSourceCategoryCode || resolveSourceCategoryCodeForCategory(sourceCategory);
        await ensureSourceCategoryValue(client, sourceCategoryCode);
      }

      if (specificCategory) {
        const resolvedSpecificSource = resolveSourceCategoryForSpecificCategory(
          specificCategory,
          sourceCategoryCode || getPayloadProductCode(payload) || DEFAULT_SOURCE_CATEGORY_CODE
        );
        if (resolvedSpecificSource.sourceName && (!sourceCategory || resolvedSpecificSource.matched)) {
          const linkedSourceCategory = await findSourceCategoryByName(
            client,
            organizationId,
            resolvedSpecificSource.sourceName
          ) || await createSourceCategory(client, organizationId, resolvedSpecificSource.sourceName);
          sourceCategory = linkedSourceCategory;
          sourceCategoryCode = resolvedSpecificSource.sourceCode;
          await ensureSourceCategoryValue(client, sourceCategoryCode);
        }
        if (sourceCategory && !sourceCategoryCode) {
          sourceCategoryCode = resolveSourceCategoryCodeForCategory(sourceCategory);
          await ensureSourceCategoryValue(client, sourceCategoryCode);
        }
        if (sourceCategory) {
          await createSpecificCategory(client, organizationId, {
            name: specificCategory,
            sourceCategoryId: sourceCategory.id,
            sourceCategoryCode,
          }).catch((err) => {
            console.warn("Category persistence failed:", err?.message || err);
          });
        }
      }

      const actor = buildActorFromUser(authUser);
      const beforeRes = await client.query(
        `SELECT
           p.id,
           COALESCE(sc.name, NULLIF(p."specificCategory", ''), NULLIF(p."sourceCategoryCode", ''), 'Unassigned') AS "previousCategory"
         FROM "product" p
         LEFT JOIN "sourceCategory" sc
           ON sc.id = p."sourceCategoryId"
          AND sc."organizationId" = p."organizationId"
         WHERE p."organizationId" = $1
           AND p.id = ANY($2::int[])
           AND COALESCE(p."isDeleted", false) = false`,
        [organizationId, productIds]
      );

      if (beforeRes.rowCount === 0) {
        return {
          statusCode: 404,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "No matching inventory items found." }),
        };
      }

      const movedByPreviousCategory = beforeRes.rows.reduce((accumulator, row) => {
        const key = row.previousCategory || "Unassigned";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {});

      const updateParts = [];
      const updateParams = [];
      if (sourceCategory) {
        updateParams.push(sourceCategory.id);
        updateParts.push(`"sourceCategoryId" = $${updateParams.length}`);
        updateParams.push(sourceCategoryCode);
        updateParts.push(`"sourceCategoryCode" = $${updateParams.length}`);
      }
      if (specificCategory) {
        updateParams.push(specificCategory);
        updateParts.push(`"specificCategory" = $${updateParams.length}`);
      }
      updateParams.push(actor.userId);
      updateParts.push(`"lastUpdatedByUserId" = COALESCE($${updateParams.length}, "lastUpdatedByUserId")`);
      updateParts.push(`"lastUpdatedAt" = NOW()`);
      updateParts.push(`"updatedAt" = NOW()`);
      updateParams.push(organizationId, productIds);

      const updateRes = await client.query(
        `UPDATE "product"
         SET ${updateParts.join(", ")}
         WHERE "organizationId" = $${updateParams.length - 1}
           AND id = ANY($${updateParams.length}::int[])
           AND COALESCE("isDeleted", false) = false
         RETURNING id, name, "sourceCategoryId", "sourceCategoryCode", "specificCategory", "lastUpdatedAt", "lastUpdatedByUserId"`,
        updateParams
      );

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          movedCount: updateRes.rowCount,
          sourceCategory,
          specificCategory,
          movedByPreviousCategory,
          items: updateRes.rows.map((row) => withInventoryAliases({
            ...row,
            sourceCategoryName: sourceCategory?.name,
            sourceCategorySlug: sourceCategory?.slug,
            lastUpdatedByName: actor.userName,
            lastUpdatedByEmail: actor.userEmail,
          })),
        }),
      };
    }

    if (postAction === "reassign-specific-category") {
      const authUser = authenticatedUser;
      if (!authUser || !isAdminRole(authUser.role)) {
        return {
        statusCode: 410,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: "Category reassignment actions have been retired.",
        }),
        };
      }

      const productIds = Array.isArray(payload.productIds)
        ? payload.productIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
        : [];

      if (!productIds.length) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Select at least one inventory item." }),
        };
      }

      const specificCategory = normalizeCategoryName(sanitizeString(getPayloadCategoryName(payload) || "", 120));
      if (!specificCategory) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Choose a category." }),
        };
      }

      const requestedSourceCategoryId = Number(getPayloadProductId(payload));
      const requestedSourceCategoryName = cleanInventoryText(
        getPayloadProductName(payload) || "",
        120
      );
      let category = Number.isFinite(requestedSourceCategoryId) && requestedSourceCategoryId > 0
        ? await findSourceCategoryById(client, organizationId, requestedSourceCategoryId)
        : null;
      if (!category && requestedSourceCategoryName) {
        category = await findSourceCategoryByName(client, organizationId, requestedSourceCategoryName);
      }
      if (!category && payload.createIfMissing && requestedSourceCategoryName) {
        category = await createSourceCategory(client, organizationId, requestedSourceCategoryName);
      }
      if (!category) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Choose a valid product." }),
        };
      }
      const resolvedSourceCode = normalizeSourceCategoryCodeValue(
        getPayloadProductCode(payload)
      ) || resolveSourceCategoryCodeForCategory(category);
      await ensureSourceCategoryValue(client, resolvedSourceCode);
      await createSpecificCategory(client, organizationId, {
        name: specificCategory,
        sourceCategoryId: category.id,
        sourceCategoryCode: resolvedSourceCode,
      }).catch((err) => {
        console.warn("Category persistence failed:", err?.message || err);
      });

      const actor = buildActorFromUser(authUser);
      const beforeRes = await client.query(
        `SELECT
           p.id,
           COALESCE(NULLIF(p."specificCategory", ''), sc.name, NULLIF(p."sourceCategoryCode", ''), 'Unassigned') AS "previousCategory"
         FROM "product" p
         LEFT JOIN "sourceCategory" sc
           ON sc.id = p."sourceCategoryId"
          AND sc."organizationId" = p."organizationId"
         WHERE p."organizationId" = $1
           AND p.id = ANY($2::int[])
           AND COALESCE(p."isDeleted", false) = false`,
        [organizationId, productIds]
      );

      if (beforeRes.rowCount === 0) {
        return {
          statusCode: 404,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "No matching inventory items found." }),
        };
      }

      const movedByPreviousCategory = beforeRes.rows.reduce((accumulator, row) => {
        const key = row.previousCategory || "Unassigned";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {});

      const updateRes = await client.query(
        `UPDATE "product"
         SET "sourceCategoryId" = $1,
             "sourceCategoryCode" = $2,
             "specificCategory" = $3,
             "lastUpdatedByUserId" = COALESCE($4, "lastUpdatedByUserId"),
             "lastUpdatedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE "organizationId" = $5
           AND id = ANY($6::int[])
           AND COALESCE("isDeleted", false) = false
         RETURNING id, name, "sourceCategoryId", "sourceCategoryCode", "specificCategory", "lastUpdatedAt", "lastUpdatedByUserId"`,
        [category.id, resolvedSourceCode, specificCategory, actor.userId, organizationId, productIds]
      );

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          movedCount: updateRes.rowCount,
          sourceCategory: category,
          specificCategory,
          movedByPreviousCategory,
          items: updateRes.rows.map((row) => withInventoryAliases({
            ...row,
            sourceCategoryName: category.name,
            sourceCategorySlug: category.slug,
            lastUpdatedByName: actor.userName,
            lastUpdatedByEmail: actor.userEmail,
          })),
        }),
      };
    }

    if (postAction === "reassign-source-category") {
      const authUser = authenticatedUser;
      if (!authUser || !isAdminRole(authUser.role)) {
          return {
          statusCode: 410,
          headers: getCorsHeaders(event),
          body: JSON.stringify({
            error: "Category reassignment actions have been retired.",
          }),
        };
      }

      const productIds = Array.isArray(payload.productIds)
        ? payload.productIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
        : [];

      if (!productIds.length) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Select at least one inventory item." }),
        };
      }

      const requestedProductName = getPayloadProductName(payload);
      let category = await findSourceCategoryById(client, organizationId, getPayloadProductId(payload));
      if (!category && requestedProductName) {
        category = await findSourceCategoryByName(client, organizationId, requestedProductName);
      }
      if (!category && payload.createIfMissing && requestedProductName) {
        category = await createSourceCategory(client, organizationId, requestedProductName);
      }
      if (!category) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Choose a valid product." }),
        };
      }
      const sourceCategoryCode = resolveSourceCategoryCodeForCategory(category);
      await ensureSourceCategoryValue(client, sourceCategoryCode);

      const actor = buildActorFromUser(authUser);
      const beforeRes = await client.query(
        `SELECT
           p.id,
           COALESCE(sc.name, NULLIF(p."specificCategory", ''), NULLIF(p."sourceCategoryCode", ''), 'Unassigned') AS "previousCategory"
         FROM "product" p
         LEFT JOIN "sourceCategory" sc
           ON sc.id = p."sourceCategoryId"
          AND sc."organizationId" = p."organizationId"
         WHERE p."organizationId" = $1
           AND p.id = ANY($2::int[])
           AND COALESCE(p."isDeleted", false) = false`,
        [organizationId, productIds]
      );

      if (beforeRes.rowCount === 0) {
        return {
          statusCode: 404,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "No matching inventory items found." }),
        };
      }

      const movedByPreviousCategory = beforeRes.rows.reduce((accumulator, row) => {
        const key = row.previousCategory || "Unassigned";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {});

      const updateRes = await client.query(
        `UPDATE "product"
         SET "sourceCategoryId" = $1,
             "sourceCategoryCode" = $2,
             "specificCategory" = $3,
             "lastUpdatedByUserId" = COALESCE($4, "lastUpdatedByUserId"),
             "lastUpdatedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE "organizationId" = $5
           AND id = ANY($6::int[])
           AND COALESCE("isDeleted", false) = false
         RETURNING id, name, "sourceCategoryId", "sourceCategoryCode", "specificCategory", "lastUpdatedAt", "lastUpdatedByUserId"`,
        [category.id, sourceCategoryCode, category.name, actor.userId, organizationId, productIds]
      );

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          movedCount: updateRes.rowCount,
          sourceCategory: category,
          movedByPreviousCategory,
          items: updateRes.rows.map((row) => withInventoryAliases({
            ...row,
            sourceCategoryName: category.name,
            sourceCategorySlug: category.slug,
            lastUpdatedByName: actor.userName,
            lastUpdatedByEmail: actor.userEmail,
          })),
        }),
      };
    }

    const name = sanitizeString(payload.name, 160);
    const sourceCategoryCode = sanitizeString(
      getPayloadProductCode(payload) || "",
      30
    ).toUpperCase();
    const hasItemTypeInput =
      Object.prototype.hasOwnProperty.call(payload, "itemType")
      || Object.prototype.hasOwnProperty.call(payload, "inventoryItemType");
    const requestedItemType = hasItemTypeInput
      ? normalizeInventoryItemType(payload.itemType || payload.inventoryItemType)
      : null;
    const requestedSourceCategoryId = Number(getPayloadProductId(payload));
    const requestedSourceCategoryName = cleanInventoryText(
      getPayloadProductName(payload) || "",
      120
    );
    const specificCategory = sanitizeString(getPayloadCategoryName(payload) || "", 120);
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

    let selectedSourceCategory = null;
    if (Number.isFinite(requestedSourceCategoryId) && requestedSourceCategoryId > 0) {
      selectedSourceCategory = await findSourceCategoryById(
        client,
        organizationId,
        requestedSourceCategoryId
      );
      if (!selectedSourceCategory) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: "Selected product was not found." }),
        };
      }
    } else if (requestedSourceCategoryName) {
      selectedSourceCategory = await findSourceCategoryByName(
        client,
        organizationId,
        requestedSourceCategoryName
      );
      if (!selectedSourceCategory && isAdminRole(authenticatedUser?.role)) {
        selectedSourceCategory = await createSourceCategory(
          client,
          organizationId,
          requestedSourceCategoryName
        );
      }
    }
    const safeSource = sourceCategoryCode
      || (selectedSourceCategory ? resolveSourceCategoryCodeForCategory(selectedSourceCategory) : "")
      || DEFAULT_SOURCE_CATEGORY_CODE;

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
      payload.purchasePriceGbpFromCad ??
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

    if (!isUpdate && !canEditInventoryDirectly(actorRole)) {
      return {
        statusCode: 403,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: "Only owners, admins, and managers can create inventory items." }),
      };
    }

    const resolvedSpecificSource = specificCategory
      ? resolveSourceCategoryForSpecificCategory(specificCategory, safeSource)
      : null;
    if (
      specificCategory
      && resolvedSpecificSource?.sourceName
      && (resolvedSpecificSource.matched || !selectedSourceCategory)
    ) {
      const linkedSourceCategory = await findSourceCategoryByName(
        client,
        organizationId,
        resolvedSpecificSource.sourceName
      ) || (
        isAdminRole(actorRole)
          ? await createSourceCategory(client, organizationId, resolvedSpecificSource.sourceName)
          : null
      );
      if (linkedSourceCategory) {
        selectedSourceCategory = linkedSourceCategory;
      }
    }
    const selectedSourceCategoryCode = selectedSourceCategory
      ? resolveSourceCategoryCodeForCategory(selectedSourceCategory)
      : safeSource;

    // If updating an existing product, retain its SKU and current field values.
    let sku = null;
    let nextBarcode = barcode;
    let nextDescription = description || null;
    let nextItemType = requestedItemType || "STANDARD";
    let nextSourceCategoryId = selectedSourceCategory?.id || null;
    let nextSourceCategoryCode = selectedSourceCategoryCode;
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
    let previousStock = null;

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
           "itemType",
           "sourceCategoryId",
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
      previousStock = Number(currentProduct.stock || 0);
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
      nextItemType = requestedItemType || currentProduct.itemType || "STANDARD";
      nextSourceCategoryId = selectedSourceCategory
        ? selectedSourceCategory.id
        : currentProduct.sourceCategoryId || null;
      nextSpecificCategory = nextSpecificCategory || currentProduct.specificCategory || null;

      if (
        normalizeInventoryItemType(nextItemType) === "VARIANT_PARENT"
        && nextStock !== previousStock
      ) {
        return {
          statusCode: 409,
          headers: getCorsHeaders(event),
          body: JSON.stringify({
            error: "Cannot adjust stock directly on variant parent items.",
            detail: "Variant parent stock is calculated from individual variant stock. Edit variant stock from the variant table instead.",
          }),
        };
      }

      const isRentalItem = String(currentProduct.sourceCategoryCode || "").trim().toUpperCase() === "RENTAL";
      if (isRentalItem && nextStock !== previousStock) {
        const maxBookedRes = await client.query(
          `SELECT COALESCE(MAX(daily_qty), 0)::int AS max_booked
           FROM (
             SELECT SUM(bi.quantity) AS daily_qty
             FROM "bookingItem" bi
             JOIN "booking" b ON b.id = bi."bookingId"
             WHERE bi."productId" = $1
               AND bi."variantId" IS NULL
               AND bi."organizationId" = $2
               AND LOWER(b.status) IN ('pending', 'confirmed')
             GROUP BY b."eventDate"::date
           ) daily`,
          [parsedId, organizationId]
        );
        const maxBooked = Number(maxBookedRes.rows[0]?.max_booked || 0);
        if (nextStock < maxBooked) {
          return {
            statusCode: 409,
            headers: getCorsHeaders(event),
            body: JSON.stringify({
              error: `Cannot reduce rental capacity below ${maxBooked} — that many units are already booked on at least one date.`,
            }),
          };
        }
      }

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
          await notifyManager(
            client,
            {
              title: "Inventory edit approval",
              body: `${actor.userName || "Staff"} requested changes for ${currentProduct.name || `Item #${parsedId}`}.`,
              data: {
                type: "inventory-edit-request",
                requestId: requestResult.rows[0]?.id,
                productId: parsedId,
              },
            },
            { organizationId }
          );
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
        nextItemType = currentProduct.itemType || nextItemType;
        nextSourceCategoryId = currentProduct.sourceCategoryId || null;
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
      sku = generateSku(name, nextSourceCategoryCode);
    }

    await ensureSourceCategoryValue(client, nextSourceCategoryCode);
    if (nextSpecificCategory) {
      await createSpecificCategory(client, organizationId, {
        name: nextSpecificCategory,
        sourceCategoryId: nextSourceCategoryId,
        sourceCategoryCode: nextSourceCategoryCode,
      }).catch((err) => {
        console.warn("Category persistence failed:", err?.message || err);
      });
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
        "itemType",
        "sourceCategoryId",
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,true,$25,NOW(),NOW(),NOW())
      ON CONFLICT ("organizationId", "sku") DO UPDATE
      SET "barcode" = EXCLUDED."barcode",
          "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "vendorId" = EXCLUDED."vendorId",
          "itemType" = EXCLUDED."itemType",
          "sourceCategoryId" = EXCLUDED."sourceCategoryId",
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
        "itemType" AS "itemType",
        "sourceCategoryId" AS "sourceCategoryId",
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
          WHEN UPPER(COALESCE("sourceCategoryCode", '')) = 'RENTAL' THEN 'Available'
          WHEN stock IS NOT NULL AND stock <= 0 THEN 'Unavailable'
          ELSE 'Available'
        END AS availability,
        currency,
        "lastUpdatedAt",
        "lastUpdatedByUserId"
    `;

    let created = null;
    let syncedVendorIds = [];
    await client.query("BEGIN");
    try {
      const result = await client.query(insertQuery, [
        organizationId,
        sku,
        nextBarcode,
        name,
        nextDescription,
        nextVendorId,
        nextItemType,
        nextSourceCategoryId,
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

      created = result.rows[0];
      syncedVendorIds = await setProductVendorLinks(client, {
        organizationId,
        productId: created?.id,
        vendorIds: nextVendorIds,
      });

      if (isUpdate) {
        await recordInventoryStockAdjustment(client, {
          organizationId,
          productId: created?.id,
          previousStock,
          nextStock,
          actor,
        });
      }

      await client.query("COMMIT");
    } catch (transactionError) {
      await client.query("ROLLBACK").catch(() => {});
      throw transactionError;
    }

    return {
      statusCode: isUpdate ? 200 : 201,
      headers: getCorsHeaders(event),
      body: JSON.stringify(withInventoryAliases({
        ...created,
        sourceCategoryName: selectedSourceCategory?.name || null,
        sourceCategorySlug: selectedSourceCategory?.slug || null,
        variants: [],
        vendorId: syncedVendorIds[0] || null,
        vendorIds: syncedVendorIds,
        lastUpdatedByName: actor.userName,
        lastUpdatedByEmail: actor.userEmail,
      })),
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
