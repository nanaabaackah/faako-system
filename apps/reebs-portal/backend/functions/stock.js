/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// Filename: stock.js
// API handler to manage stock movements (Stock In/Out) and update Product stock.

import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  ensureAuditColumns,
  backfillAuditDefaults,
} from "./auditHelpers.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { ensureInventoryVariantSchema } from "./_shared/inventoryExtensions.js";

const STOCK_METHODS = "POST,OPTIONS";

const normalizeStockType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "stockin") return "StockIn";
  if (normalized === "stockout") return "StockOut";
  return "";
};

const parsePositiveInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: STOCK_METHODS });
  }
  if (event.httpMethod !== "POST") {
    return respond(event, 405, { error: "Method Not Allowed. Use POST." }, { methods: STOCK_METHODS });
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (error) {
    return respond(event, 400, { error: "Invalid JSON format in request body." }, { methods: STOCK_METHODS });
  }

  const { productId, variantId, type, quantity, notes, reference, soldMonth } = data;
  const normalizedProductId = parsePositiveInteger(productId);
  if (!normalizedProductId || !type || quantity == null) {
    return respond(
      event,
      400,
      { error: "Missing required fields: productId, type (StockIn/StockOut), and quantity." },
      { methods: STOCK_METHODS }
    );
  }

  const productQuantity = parsePositiveInteger(quantity);
  if (!productQuantity) {
    return respond(event, 400, { error: "Quantity must be a positive whole number." }, {
      methods: STOCK_METHODS,
    });
  }

  const normalizeSoldMonth = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return `${trimmed}-01`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  };

  const normalizedType = normalizeStockType(type);
  if (!normalizedType) {
    return respond(event, 400, { error: "Type must be StockIn or StockOut." }, {
      methods: STOCK_METHODS,
    });
  }

  const soldMonthValue = normalizeSoldMonth(soldMonth);
  if (soldMonth != null && !soldMonthValue) {
    return respond(event, 400, { error: "soldMonth must be YYYY-MM or YYYY-MM-DD." }, {
      methods: STOCK_METHODS,
    });
  }

  const stockDelta = normalizedType === "StockIn" ? productQuantity : -productQuantity;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureAuditColumns(client);
    await ensureInventoryVariantSchema(client);
    const authResult = await requireInternalUser(client, event, {
      methods: STOCK_METHODS,
      roles: ["owner", "admin", "manager"],
      roleError: "Only owners, admins, and managers can adjust stock directly.",
    });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const { authUser, organizationId } = authResult;
    const actor = {
      userId: authUser.id,
      userName: authUser.fullName,
      userEmail: authUser.email,
    };
    await backfillAuditDefaults(client, actor.userId, organizationId);

    // Block StockOut on rental items — capacity is managed through bookings only.
    if (normalizedType === "StockOut") {
      const rentalCheck = await client.query(
        `SELECT "sourceCategoryCode" FROM "product"
         WHERE id = $1 AND "organizationId" = $2`,
        [normalizedProductId, organizationId]
      );
      const sourceCode = String(rentalCheck.rows[0]?.sourceCategoryCode || "").trim().toUpperCase();
      if (sourceCode === "RENTAL") {
        return respond(event, 400, {
          error: "StockOut is not permitted for rental items. Rental capacity is managed through bookings.",
        }, { methods: STOCK_METHODS });
      }
    }

    await client.query("BEGIN");

    let updateResult = null;
    let normalizedVariantId = null;
    if (variantId) {
      normalizedVariantId = parsePositiveInteger(variantId);
      if (!normalizedVariantId) {
        await client.query("ROLLBACK");
        return respond(event, 400, { error: "variantId must be a valid id." }, {
          methods: STOCK_METHODS,
        });
      }

      const variantCheck = await client.query(
        `SELECT id, "inventoryItemId"
         FROM "inventoryVariant"
         WHERE id = $1
           AND "inventoryItemId" = $2
           AND "organizationId" = $3
         FOR UPDATE`,
        [normalizedVariantId, normalizedProductId, organizationId]
      );
      if (variantCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return respond(event, 404, { error: "Variant not found for that product." }, {
          methods: STOCK_METHODS,
        });
      }

      updateResult = await client.query(
        `UPDATE "inventoryVariant"
         SET "stockQty" = "stockQty" + $1,
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $3
           AND (
             $1 >= 0
             OR GREATEST("stockQty" - "reservedQty", 0) >= ABS($1)
           )
         RETURNING id, "stockQty", "reservedQty", GREATEST("stockQty" - "reservedQty", 0) AS "availableQty"`,
        [stockDelta, normalizedVariantId, organizationId]
      );
      if (updateResult.rowCount > 0) {
        await client.query(
          `UPDATE "product" p
           SET stock = COALESCE((
                 SELECT SUM(v."stockQty")::int
                 FROM "inventoryVariant" v
                 WHERE v."organizationId" = p."organizationId"
                   AND v."inventoryItemId" = p.id
                   AND lower(COALESCE(v.status, 'active')) <> 'inactive'
               ), p.stock),
               "lastUpdatedByUserId" = COALESCE($2, "lastUpdatedByUserId"),
               "lastUpdatedAt" = NOW(),
               "updatedAt" = NOW()
           WHERE p.id = $1 AND p."organizationId" = $3`,
          [normalizedProductId, actor.userId, organizationId]
        );
      }
    } else {
      const updateProductQuery = `
        UPDATE "product"
        SET "stock" = COALESCE("stock", 0) + $1,
            "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
            "lastUpdatedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "id" = $2
          AND "organizationId" = $4
          AND (
            $1 >= 0
            OR COALESCE("stock", 0) >= ABS($1)
          )
        RETURNING "id", "stock", "lastUpdatedAt", "lastUpdatedByUserId";
      `;
      updateResult = await client.query(updateProductQuery, [
        stockDelta,
        normalizedProductId,
        actor.userId,
        organizationId,
      ]);
    }

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return respond(event, 404, { error: `Product or variant with ID ${normalizedProductId} not found, or stock is insufficient.` }, {
        methods: STOCK_METHODS,
      });
    }

    const insertMovementQuery = `
      INSERT INTO "stockMovement" (
        "organizationId",
        "productId", 
        "variantId",
        "type", 
        "quantity", 
        "notes", 
        "reference",
        "soldMonth",
        "date",
        "performedByUserId",
        "performedByName",
        "performedByEmail",
        "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, NOW())
    `;

    await client.query(insertMovementQuery, [
      organizationId,
      normalizedProductId,
      normalizedVariantId,
      normalizedType,
      productQuantity,
      notes || null,
      reference || null,
      soldMonthValue,
      actor.userId,
      actor.userName,
      actor.userEmail,
    ]);

    await client.query("COMMIT");

    return respond(event, 200, {
      message: `${normalizedType} successful.`,
      productId: normalizedProductId,
      variantId: normalizedVariantId,
      newStock: normalizedVariantId
        ? updateResult.rows[0].stockQty
        : updateResult.rows[0].stock,
      variantAvailableQty: normalizedVariantId ? updateResult.rows[0].availableQty : undefined,
      lastUpdatedAt: updateResult.rows[0].lastUpdatedAt || new Date().toISOString(),
      lastUpdatedByUserId: updateResult.rows[0].lastUpdatedByUserId || actor.userId,
      lastUpdatedByName: actor.userName,
    }, {
      methods: STOCK_METHODS,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Transaction failed:", err);

    return respond(event, 500, {
      error: "Failed to process stock movement.",
    }, {
      methods: STOCK_METHODS,
    });

  } finally {
    await client.end().catch(() => {});
  }
}
