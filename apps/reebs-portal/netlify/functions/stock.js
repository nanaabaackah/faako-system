/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// Filename: stock.js
// Netlify Function to manage stock movements (Stock In/Out) and update Product stock.

import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  ensureAuditColumns,
  backfillAuditDefaults,
} from "./auditHelpers.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const STOCK_METHODS = "POST,OPTIONS";

const normalizeStockType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "stockin") return "StockIn";
  if (normalized === "stockout") return "StockOut";
  return "";
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

  const { productId, type, quantity, notes, reference, soldMonth } = data;
  if (!productId || !type || !quantity) {
    return respond(
      event,
      400,
      { error: "Missing required fields: productId, type (StockIn/StockOut), and quantity." },
      { methods: STOCK_METHODS }
    );
  }

  const productQuantity = parseInt(quantity, 10);
  if (isNaN(productQuantity) || productQuantity <= 0) {
    return respond(event, 400, { error: "Quantity must be a positive number." }, {
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

    await client.query("BEGIN");

    const updateProductQuery = `
      UPDATE "product"
      SET "stock" = "stock" + $1,
          "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
          "lastUpdatedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "id" = $2 AND "organizationId" = $4
      RETURNING "id", "stock", "lastUpdatedAt", "lastUpdatedByUserId";
    `;
    const updateResult = await client.query(updateProductQuery, [
      stockDelta,
      productId,
      actor.userId,
      organizationId,
    ]);

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return respond(event, 404, { error: `Product with ID ${productId} not found.` }, {
        methods: STOCK_METHODS,
      });
    }

    const insertMovementQuery = `
      INSERT INTO "stockMovement" (
        "organizationId",
        "productId", 
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, NOW())
    `;

    await client.query(insertMovementQuery, [
      organizationId,
      productId,
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
      productId: productId,
      newStock: updateResult.rows[0].stock,
      lastUpdatedAt: updateResult.rows[0].lastUpdatedAt,
      lastUpdatedByUserId: updateResult.rows[0].lastUpdatedByUserId,
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
