/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { ensureAuditColumns } from "./auditHelpers.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import {
  cleanInventoryText,
  ensureInventoryVariantSchema,
  slugifySourceCategory,
} from "./_shared/inventoryExtensions.js";

const METHODS = "GET,POST,PATCH,DELETE,OPTIONS";

const json = (event, statusCode, payload) =>
  respond(event, statusCode, payload, { methods: METHODS });

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};

const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

const toMoneyCents = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed * 100));
};

const toCentsValue = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
};

const readPriceOverrideCents = (body) => {
  if (Object.prototype.hasOwnProperty.call(body, "priceOverrideCents")) {
    return toCentsValue(body.priceOverrideCents);
  }
  return toMoneyCents(body.priceOverride);
};

const serializeVariant = (row) => ({
  ...row,
  stockQty: Number(row.stockQty ?? row.stockqty ?? 0),
  reservedQty: Number(row.reservedQty ?? row.reservedqty ?? 0),
  availableQty: Math.max(
    Number(row.stockQty ?? row.stockqty ?? 0) - Number(row.reservedQty ?? row.reservedqty ?? 0),
    0
  ),
  priceOverride:
    row.priceOverride === null || typeof row.priceOverride === "undefined"
      ? null
      : Number(row.priceOverride) / 100,
});

const selectVariants = async (client, organizationId, itemId) => {
  const parsedItemId = Number(itemId);
  if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) {
    const error = new Error("Inventory item id is required.");
    error.statusCode = 400;
    throw error;
  }

  const result = await client.query(
    `SELECT
       v.id,
       v."organizationId",
       v."inventoryItemId",
       v.sku,
       v."variantName",
       v."variantNumber",
       v.color,
       v.size,
       v."stockQty",
       v."reservedQty",
       GREATEST(v."stockQty" - v."reservedQty", 0) AS "availableQty",
       v."reorderLevel",
       v."priceOverride",
       v.status,
       v."createdAt",
       v."updatedAt",
       p.name AS "productName",
       p.price AS "productPrice"
     FROM "inventoryVariant" v
     JOIN "product" p
       ON p.id = v."inventoryItemId"
      AND p."organizationId" = v."organizationId"
     WHERE v."organizationId" = $1
       AND v."inventoryItemId" = $2
     ORDER BY
       lower(COALESCE(v."variantName", '')),
       NULLIF(regexp_replace(COALESCE(v."variantNumber", ''), '[^0-9]', '', 'g'), '')::int NULLS LAST,
       lower(COALESCE(v.color, '')),
       lower(COALESCE(v.size, '')),
       v.id`,
    [organizationId, parsedItemId]
  );
  return result.rows.map(serializeVariant);
};

const getParent = async (client, organizationId, itemId) => {
  const parsedItemId = Number(itemId);
  if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) return null;
  const result = await client.query(
    `SELECT id, sku, name, price, "itemType"
     FROM "product"
     WHERE id = $1 AND "organizationId" = $2
     LIMIT 1`,
    [parsedItemId, organizationId]
  );
  return result.rows[0] || null;
};

const buildVariantSku = (parentSku, { variantName, variantNumber, color, size }, index = 0) => {
  const suffix = [
    variantName ? slugifySourceCategory(variantName).toUpperCase().slice(0, 8) : "",
    variantNumber ? `N${variantNumber}` : "",
    color ? slugifySourceCategory(color).toUpperCase().slice(0, 8) : "",
    size ? slugifySourceCategory(size).toUpperCase().slice(0, 8) : "",
    index ? String(index) : "",
  ].filter(Boolean);
  return `${String(parentSku || "VAR").toUpperCase()}-${suffix.join("-") || "VAR"}`.slice(0, 120);
};

const createVariant = async (client, organizationId, body) => {
  const parent = await getParent(client, organizationId, body.inventoryItemId || body.itemId || body.productId);
  if (!parent) {
    const error = new Error("Inventory item not found.");
    error.statusCode = 404;
    throw error;
  }

  const variantName = cleanInventoryText(body.variantName || "", 80) || null;
  const variantNumber = cleanInventoryText(String(body.variantNumber ?? ""), 40) || null;
  const color = cleanInventoryText(body.color || "", 80) || null;
  const size = cleanInventoryText(body.size || "", 80) || null;
  const stockQty = toInt(body.stockQty ?? body.stock ?? body.quantity, 0);
  const reservedQty = toInt(body.reservedQty, 0);
  if (reservedQty > stockQty) {
    const error = new Error("Reserved quantity cannot exceed stock quantity.");
    error.statusCode = 409;
    throw error;
  }
  const reorderLevel = toInt(body.reorderLevel, 2);
  const priceOverride = readPriceOverrideCents(body);
  const status = cleanInventoryText(body.status || "active", 32).toLowerCase() || "active";
  const sku = cleanInventoryText(
    body.sku || buildVariantSku(parent.sku, { variantName, variantNumber, color, size }),
    120
  );

  const result = await client.query(
    `INSERT INTO "inventoryVariant" (
       "organizationId",
       "inventoryItemId",
       sku,
       "variantName",
       "variantNumber",
       color,
       size,
       "stockQty",
       "reservedQty",
       "reorderLevel",
       "priceOverride",
       status,
       "createdAt",
       "updatedAt"
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
     ON CONFLICT DO NOTHING
     RETURNING
       id,
       "organizationId",
       "inventoryItemId",
       sku,
       "variantName",
       "variantNumber",
       color,
       size,
       "stockQty",
       "reservedQty",
       GREATEST("stockQty" - "reservedQty", 0) AS "availableQty",
       "reorderLevel",
       "priceOverride",
       status,
       "createdAt",
       "updatedAt"`,
    [
      organizationId,
      parent.id,
      sku,
      variantName,
      variantNumber,
      color,
      size,
      stockQty,
      reservedQty,
      reorderLevel,
      priceOverride,
      status,
    ]
  );

  await client.query(
    `UPDATE "product"
     SET "itemType" = 'VARIANT_PARENT',
         stock = COALESCE((
           SELECT SUM(v."stockQty")::int
           FROM "inventoryVariant" v
           WHERE v."organizationId" = $2
             AND v."inventoryItemId" = $1
             AND lower(COALESCE(v.status, 'active')) <> 'inactive'
         ), 0),
         "updatedAt" = NOW()
     WHERE id = $1 AND "organizationId" = $2`,
    [parent.id, organizationId]
  );

  if (result.rowCount > 0) return serializeVariant(result.rows[0]);
  const variants = await selectVariants(client, organizationId, parent.id);
  const existingVariant = variants.find(
    (variant) =>
      String(variant.variantName || "") === String(variantName || "")
      && String(variant.variantNumber || "") === String(variantNumber || "")
      && String(variant.color || "") === String(color || "")
      && String(variant.size || "") === String(size || "")
  );
  if (existingVariant) return existingVariant;
  const error = new Error("A variant with that SKU already exists.");
  error.statusCode = 409;
  throw error;
};

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanInventoryText(String(entry || ""), 80)).filter(Boolean);
  }
  const cleaned = cleanInventoryText(String(value || ""), 240);
  if (!cleaned) return [];
  return cleaned.split(",").map((entry) => cleanInventoryText(entry, 80)).filter(Boolean);
};

const generateVariants = async (client, organizationId, body) => {
  const parent = await getParent(client, organizationId, body.inventoryItemId || body.itemId || body.productId);
  if (!parent) {
    const error = new Error("Inventory item not found.");
    error.statusCode = 404;
    throw error;
  }

  const names = normalizeList(body.names);
  const numbersInput = Array.isArray(body.numbers) ? body.numbers : null;
  const numbers = numbersInput !== null
    ? [...new Set(numbersInput.map((entry) => cleanInventoryText(String(entry).trim(), 40)).filter(Boolean))]
    : [];
  const colors = normalizeList(body.colors);
  const sizes = normalizeList(body.sizes);

  if (!names.length && !numbers.length && !colors.length && !sizes.length) {
    const error = new Error("Provide at least one variant dimension: names, numbers, colors, or sizes.");
    error.statusCode = 400;
    throw error;
  }

  const nameValues = names.length ? names : [null];
  const numberValues = numbers.length ? numbers : [null];
  const colorValues = colors.length ? colors : [null];
  const sizeValues = sizes.length ? sizes : [null];
  const stockQty = toInt(body.stockQty ?? body.defaultStockQty, 0);
  const reservedQty = toInt(body.reservedQty, 0);
  if (reservedQty > stockQty) {
    const error = new Error("Reserved quantity cannot exceed stock quantity.");
    error.statusCode = 409;
    throw error;
  }
  const reorderLevel = toInt(body.reorderLevel, 2);
  const priceOverride = readPriceOverrideCents(body);
  const created = [];
  const skipped = [];

  await client.query("BEGIN");
  try {
    for (const variantName of nameValues) {
      for (const variantNumber of numberValues) {
        for (const color of colorValues) {
          for (const size of sizeValues) {
            const sku = buildVariantSku(parent.sku, { variantName, variantNumber, color, size });
            const result = await client.query(
              `INSERT INTO "inventoryVariant" (
                 "organizationId",
                 "inventoryItemId",
                 sku,
                 "variantName",
                 "variantNumber",
                 color,
                 size,
                 "stockQty",
                 "reservedQty",
                 "reorderLevel",
                 "priceOverride",
                 status,
                 "createdAt",
                 "updatedAt"
               )
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',NOW(),NOW())
               ON CONFLICT DO NOTHING
               RETURNING
                 id,
                 "organizationId",
                 "inventoryItemId",
                 sku,
                 "variantName",
                 "variantNumber",
                 color,
                 size,
                 "stockQty",
                 "reservedQty",
                 GREATEST("stockQty" - "reservedQty", 0) AS "availableQty",
                 "reorderLevel",
                 "priceOverride",
                 status,
                 "createdAt",
                 "updatedAt"`,
              [
                organizationId,
                parent.id,
                sku,
                variantName,
                variantNumber,
                color,
                size,
                stockQty,
                reservedQty,
                reorderLevel,
                priceOverride,
              ]
            );
            if (result.rowCount > 0) {
              created.push(serializeVariant(result.rows[0]));
            } else {
              skipped.push({ variantName, variantNumber, color, size });
            }
          }
        }
      }
    }

    await client.query(
      `UPDATE "product"
       SET "itemType" = 'VARIANT_PARENT',
           stock = COALESCE((
             SELECT SUM(v."stockQty")::int
             FROM "inventoryVariant" v
             WHERE v."organizationId" = $2
               AND v."inventoryItemId" = $1
               AND lower(COALESCE(v.status, 'active')) <> 'inactive'
           ), 0),
           "lastUpdatedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE id = $1 AND "organizationId" = $2`,
      [parent.id, organizationId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }

  return {
    itemId: parent.id,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
  };
};

const updateVariant = async (client, organizationId, body, actor) => {
  const variantId = Number(body.id || body.variantId);
  if (!Number.isFinite(variantId) || variantId <= 0) {
    const error = new Error("Variant id is required.");
    error.statusCode = 400;
    throw error;
  }

  const fields = [];
  const params = [];
  const assign = (column, value) => {
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  };

  if (Object.prototype.hasOwnProperty.call(body, "sku")) {
    const sku = cleanInventoryText(body.sku, 120);
    if (!sku) {
      const error = new Error("SKU is required.");
      error.statusCode = 400;
      throw error;
    }
    assign("sku", sku);
  }
  if (Object.prototype.hasOwnProperty.call(body, "variantNumber")) {
    assign(`"variantNumber"`, cleanInventoryText(String(body.variantNumber || ""), 40) || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "variantName")) {
    assign(`"variantName"`, cleanInventoryText(body.variantName || "", 80) || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "color")) {
    assign("color", cleanInventoryText(body.color || "", 80) || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "size")) {
    assign("size", cleanInventoryText(body.size || "", 80) || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, "stockQty")) {
    assign(`"stockQty"`, toInt(body.stockQty, 0));
  }
  if (Object.prototype.hasOwnProperty.call(body, "reservedQty")) {
    assign(`"reservedQty"`, toInt(body.reservedQty, 0));
  }
  if (Object.prototype.hasOwnProperty.call(body, "reorderLevel")) {
    assign(`"reorderLevel"`, toInt(body.reorderLevel, 0));
  }
  if (
    Object.prototype.hasOwnProperty.call(body, "priceOverride")
    || Object.prototype.hasOwnProperty.call(body, "priceOverrideCents")
  ) {
    assign(`"priceOverride"`, readPriceOverrideCents(body));
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    assign("status", cleanInventoryText(body.status || "active", 32).toLowerCase() || "active");
  }

  if (!fields.length) {
    const error = new Error("No variant updates provided.");
    error.statusCode = 400;
    throw error;
  }

  await client.query("BEGIN");
  try {
    const currentRes = await client.query(
      `SELECT id, "inventoryItemId", sku, "stockQty", "reservedQty"
       FROM "inventoryVariant"
       WHERE id = $1 AND "organizationId" = $2
       FOR UPDATE`,
      [variantId, organizationId]
    );
    if (currentRes.rowCount === 0) {
      const error = new Error("Variant not found.");
      error.statusCode = 404;
      throw error;
    }

    const current = currentRes.rows[0];
    const nextStockQty = Object.prototype.hasOwnProperty.call(body, "stockQty")
      ? toInt(body.stockQty, 0)
      : Number(current.stockQty || 0);
    const nextReservedQty = Object.prototype.hasOwnProperty.call(body, "reservedQty")
      ? toInt(body.reservedQty, 0)
      : Number(current.reservedQty || 0);
    if (nextReservedQty > nextStockQty) {
      const error = new Error("Reserved quantity cannot exceed stock quantity.");
      error.statusCode = 409;
      throw error;
    }

    params.push(variantId, organizationId);
    const result = await client.query(
      `UPDATE "inventoryVariant"
       SET ${fields.join(", ")}, "updatedAt" = NOW()
       WHERE id = $${params.length - 1}
         AND "organizationId" = $${params.length}
       RETURNING
       id,
       "organizationId",
       "inventoryItemId",
       sku,
       "variantName",
       "variantNumber",
       color,
       size,
         "stockQty",
         "reservedQty",
         GREATEST("stockQty" - "reservedQty", 0) AS "availableQty",
         "reorderLevel",
         "priceOverride",
         status,
         "createdAt",
         "updatedAt"`,
      params
    );
    const updated = serializeVariant(result.rows[0]);
    const stockDelta = Number(updated.stockQty || 0) - Number(current.stockQty || 0);
    if (stockDelta !== 0) {
      await client.query(
        `INSERT INTO "stockMovement" (
           "organizationId",
           "productId",
           "variantId",
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, NOW())`,
        [
          organizationId,
          updated.inventoryItemId,
          updated.id,
          stockDelta > 0 ? "StockIn" : "StockOut",
          Math.abs(stockDelta),
          "Variant stock adjusted from variant table.",
          updated.sku || current.sku || `Variant ${updated.id}`,
          actor?.userId || null,
          actor?.userName || null,
          actor?.userEmail || null,
        ]
      );
    }
    await client.query(
      `UPDATE "product" p
       SET stock = COALESCE((
             SELECT SUM(v."stockQty")::int
             FROM "inventoryVariant" v
             WHERE v."organizationId" = p."organizationId"
               AND v."inventoryItemId" = p.id
               AND lower(COALESCE(v.status, 'active')) <> 'inactive'
           ), 0),
           "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
           "lastUpdatedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE p.id = $1 AND p."organizationId" = $2`,
      [updated.inventoryItemId, organizationId, actor?.userId || null]
    );
    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
};

const deleteVariant = async (client, organizationId, variantId) => {
  const parsedId = Number(variantId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    const error = new Error("Variant id is required.");
    error.statusCode = 400;
    throw error;
  }

  await client.query("BEGIN");
  try {
    const currentRes = await client.query(
      `SELECT id, "inventoryItemId", "stockQty", "reservedQty"
       FROM "inventoryVariant"
       WHERE id = $1 AND "organizationId" = $2
       FOR UPDATE`,
      [parsedId, organizationId]
    );
    if (currentRes.rowCount === 0) {
      const error = new Error("Variant not found.");
      error.statusCode = 404;
      throw error;
    }
    const current = currentRes.rows[0];

    await client.query(
      `DELETE FROM "inventoryVariant" WHERE id = $1 AND "organizationId" = $2`,
      [parsedId, organizationId]
    );

    await client.query(
      `UPDATE "product"
       SET stock = COALESCE((
             SELECT SUM(v."stockQty")::int
             FROM "inventoryVariant" v
             WHERE v."organizationId" = $2
               AND v."inventoryItemId" = $1
               AND lower(COALESCE(v.status, 'active')) <> 'inactive'
           ), 0),
           "updatedAt" = NOW()
       WHERE id = $1 AND "organizationId" = $2`,
      [current.inventoryItemId, organizationId]
    );

    const remaining = await client.query(
      `SELECT COUNT(*) AS cnt FROM "inventoryVariant" WHERE "inventoryItemId" = $1 AND "organizationId" = $2`,
      [current.inventoryItemId, organizationId]
    );
    if (Number(remaining.rows[0]?.cnt || 0) === 0) {
      await client.query(
        `UPDATE "product" SET "itemType" = 'STANDARD', "updatedAt" = NOW()
         WHERE id = $1 AND "organizationId" = $2`,
        [current.inventoryItemId, organizationId]
      );
    }

    await client.query("COMMIT");
    return { deleted: true, id: parsedId, inventoryItemId: current.inventoryItemId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    return json(event, 405, { error: "Method not allowed." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureAuditColumns(client);
    const auth = await requireInternalUser(client, event, {
      methods: METHODS,
      roles: ["GET"].includes(method) ? [] : ["owner", "admin", "manager"],
      roleError: "Only owners, admins, and managers can manage inventory variants.",
    });
    if (auth.errorResponse) return auth.errorResponse;

    const { organizationId } = auth;
    await ensureInventoryVariantSchema(client);

    if (method === "GET") {
      const itemId = event.queryStringParameters?.itemId
        || event.queryStringParameters?.productId
        || event.queryStringParameters?.inventoryItemId;
      const variants = await selectVariants(client, organizationId, itemId);
      return json(event, 200, variants);
    }

    if (method === "DELETE") {
      const variantId = event.queryStringParameters?.id || event.queryStringParameters?.variantId;
      const result = await deleteVariant(client, organizationId, variantId);
      return json(event, 200, result);
    }

    const body = parseBody(event);
    if (!body) return json(event, 400, { error: "Invalid JSON body." });

    if (method === "PATCH") {
      const updated = await updateVariant(client, organizationId, body, {
        userId: auth.authUser.id,
        userName: auth.authUser.fullName,
        userEmail: auth.authUser.email,
      });
      return json(event, 200, updated);
    }

    const action = cleanInventoryText(body.action || "", 80).toLowerCase();
    if (action === "generate-number-variants" || action === "generate-variants") {
      const result = await generateVariants(client, organizationId, body);
      return json(event, 201, result);
    }

    const created = await createVariant(client, organizationId, body);
    return json(event, 201, created);
  } catch (err) {
    console.error("inventoryVariants error", err);
    const status = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, status, {
      error:
        status === 409
          ? "A matching variant already exists."
          : err?.message || "Failed to process inventory variant.",
      detail: err?.detail || null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
