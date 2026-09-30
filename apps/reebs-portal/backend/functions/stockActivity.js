import { createDatabaseClient } from "./_shared/databaseClient.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { ensureProductVendorLinksTable } from "./_shared/productVendors.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,OPTIONS" });

const ACTIVITY_SCOPE_FILTERS = new Set(["all", "shop", "rental", "outsourced"]);
const ACTIVITY_STOCK_FILTERS = new Set(["all", "in", "out", "low"]);
const ACTIVITY_MOVEMENT_TYPES = new Set(["in", "out"]);

const normalizeFilterValue = (value) => String(value || "").trim().toLowerCase();

const normalizeScopeFilter = (value) => {
  const normalized = normalizeFilterValue(value);
  return ACTIVITY_SCOPE_FILTERS.has(normalized) ? normalized : "all";
};

const normalizeStockFilter = (value) => {
  const normalized = normalizeFilterValue(value);
  return ACTIVITY_STOCK_FILTERS.has(normalized) ? normalized : "all";
};

const normalizeMovementType = (value) => {
  const normalized = normalizeFilterValue(value);
  return ACTIVITY_MOVEMENT_TYPES.has(normalized) ? normalized : "";
};

const stockInTypeSql = `LOWER(sm.type) IN ('stockin', 'shop_sale_cancelled', 'shop_return_restock')`;
const stockOutTypeSql = `LOWER(sm.type) IN ('stockout', 'shop_sale', 'shop_damaged')`;

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }

  if (method !== "GET") {
    return json(event, 405, { error: "Method not allowed" });
  }

  const client = createDatabaseClient({ component: "inventory-activity" });

  try {
    await client.connect();
    const internal = await requireInternalUser(client, event, {
      methods: "GET,OPTIONS",
      permission: "inventory:read",
      permissionError: "You do not have permission to view Inventory activity.",
    });
    if (internal.errorResponse) {
      return internal.errorResponse;
    }

    await ensureProductVendorLinksTable(client);

    const { organizationId } = internal;
    const params = [organizationId];
    const query = event.queryStringParameters || {};
    if (normalizeFilterValue(query.scope) === "water") {
      return json(event, 409, {
        error: "Water activity is available only from the Water Business module.",
        code: "INVENTORY_SCOPE_CONFLICT",
      });
    }
    const scopeFilter = normalizeScopeFilter(query.scope);
    const stockFilter = normalizeStockFilter(query.stock);
    const categoryFilter = normalizeFilterValue(query.category);
    const searchFilter = normalizeFilterValue(query.search);
    const detailMonth = String(query.month || "").trim();
    const detailMovementType = normalizeMovementType(query.movementType || query.type);
    const vendorLinkedExpression = `(
      COALESCE(p."vendorId", 0) > 0
      OR EXISTS (
        SELECT 1
        FROM "productVendorLink" pvl
        WHERE pvl."organizationId" = p."organizationId"
          AND pvl."productId" = p.id
      )
    )`;
    const productWhere = [
      `p."organizationId" = $1`,
      `COALESCE(p."isDeleted", false) = false`,
      `COALESCE(p."isArchived", false) = false`,
      `UPPER(COALESCE(p."sourceCategoryCode", '')) <> 'WATER'`,
      `NOT EXISTS (
        SELECT 1
        FROM "waterProductConfig" water_scope
        WHERE water_scope."organizationId" = p."organizationId"
          AND water_scope."inventoryProductId" = p.id
          AND water_scope."isActive" = TRUE
      )`,
    ];

    if (scopeFilter === "outsourced") {
      productWhere.push(vendorLinkedExpression);
    } else if (scopeFilter === "rental") {
      productWhere.push(`UPPER(COALESCE(p."sourceCategoryCode", '')) = 'RENTAL'`);
      productWhere.push(`NOT ${vendorLinkedExpression}`);
    } else if (scopeFilter === "shop") {
      productWhere.push(`UPPER(COALESCE(p."sourceCategoryCode", '')) <> 'RENTAL'`);
      productWhere.push(`NOT ${vendorLinkedExpression}`);
    }

    if (categoryFilter && categoryFilter !== "all") {
      params.push(`%${categoryFilter}%`);
      productWhere.push(
        `LOWER(COALESCE(p."specificCategory", p."sourceCategoryCode", '')) LIKE $${params.length}`
      );
    }

    if (searchFilter) {
      params.push(`%${searchFilter}%`);
      const searchParam = `$${params.length}`;
      productWhere.push(
        `(
          LOWER(COALESCE(p.name, '')) LIKE ${searchParam}
          OR LOWER(COALESCE(p.sku, '')) LIKE ${searchParam}
          OR LOWER(COALESCE(p."barcode", '')) LIKE ${searchParam}
        )`
      );
    }

    if (stockFilter === "in") {
      productWhere.push(`COALESCE(p.stock, 0) > 0`);
    } else if (stockFilter === "out") {
      productWhere.push(`COALESCE(p.stock, 0) <= 0`);
    } else if (stockFilter === "low") {
      productWhere.push(`COALESCE(p.stock, 0) > 0`);
      productWhere.push(`COALESCE(p.stock, 0) <= COALESCE(p."reorderLevel", 2)`);
    }

    if (normalizeFilterValue(query.view) === "movements") {
      const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
      const pageSize = Math.min(50, Math.max(10, Number.parseInt(query.pageSize || "20", 10) || 20));
      const productId = Number(query.productId);
      if (query.productId && (!Number.isSafeInteger(productId) || productId <= 0)) {
        return json(event, 400, { error: "Choose a valid inventory item." });
      }
      if (productId) {
        params.push(productId);
        productWhere.push(`p.id = $${params.length}`);
      }
      params.push(pageSize);
      const limitParam = `$${params.length}`;
      params.push((page - 1) * pageSize);
      const offsetParam = `$${params.length}`;
      const movementResult = await client.query(
        `WITH filtered_products AS (
           SELECT p.id, p.name, p.sku
           FROM "product" p
           WHERE ${productWhere.join("\n             AND ")}
         )
         SELECT
           sm.id,
           sm."productId",
           sm."variantId",
           fp.name AS "productName",
           fp.sku AS "productSku",
           v.sku AS "variantSku",
           sm.type,
           sm.quantity,
           sm.notes,
           sm.reference,
           sm."sourceType",
           sm."sourceId",
           sm."previousStock",
           sm."resultingStock",
           sm."performedByName",
           sm.date,
           COUNT(*) OVER()::int AS "totalCount"
         FROM "stockMovement" sm
         JOIN filtered_products fp ON fp.id = sm."productId"
         LEFT JOIN "inventoryVariant" v
           ON v."organizationId" = sm."organizationId"
          AND v.id = sm."variantId"
         WHERE sm."organizationId" = $1
         ORDER BY sm.date DESC, sm.id DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params
      );
      const total = Number(movementResult.rows[0]?.totalCount || 0);
      return json(event, 200, {
        items: movementResult.rows.map(({ totalCount: _totalCount, ...row }) => row),
        pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
      });
    }

    if (detailMonth || detailMovementType) {
      if (!/^\d{4}-\d{2}$/.test(detailMonth) || !detailMovementType) {
        return json(event, 400, { error: "Month and movement type are required." });
      }

      params.push(detailMonth);
      const detailMonthParam = `$${params.length}`;
      params.push(detailMovementType === "in" ? "stockin" : "stockout");
      const detailTypeParam = `$${params.length}`;

      const detailResult = await client.query(
        `WITH filtered_products AS (
           SELECT
             p.id,
             p.name,
             p.sku,
             p."imageUrl" AS image
           FROM "product" p
           WHERE ${productWhere.join("\n             AND ")}
         )
         SELECT
           fp.id,
           fp.name,
           fp.sku,
           fp.image,
           SUM(sm.quantity)::int AS total_quantity,
           COUNT(*)::int AS movement_count,
           MAX(sm."date") AS latest_date,
           MAX(sm."performedByName") FILTER (
             WHERE COALESCE(sm."performedByName", '') <> ''
           ) AS latest_actor
         FROM "stockMovement" sm
         INNER JOIN filtered_products fp
           ON fp.id = sm."productId"
         WHERE sm."organizationId" = $1
           AND to_char(date_trunc('month', sm."date"), 'YYYY-MM') = ${detailMonthParam}
           AND (
             (${detailTypeParam} = 'stockin' AND ${stockInTypeSql})
             OR (${detailTypeParam} = 'stockout' AND ${stockOutTypeSql})
           )
         GROUP BY fp.id, fp.name, fp.sku, fp.image
         ORDER BY total_quantity DESC, fp.name ASC`,
        params
      );

      return json(event, 200, {
        month: detailMonth,
        movementType: detailMovementType,
        items: detailResult.rows || [],
        filters: {
          scope: scopeFilter,
          category: categoryFilter || "all",
          search: searchFilter,
          stock: stockFilter,
        },
      });
    }

    const result = await client.query(
      `WITH filtered_products AS (
         SELECT p.id
         FROM "product" p
         WHERE ${productWhere.join("\n           AND ")}
       )
       SELECT
         to_char(date_trunc('month', sm."date"), 'YYYY-MM') AS month_key,
         date_trunc('month', sm."date") AS month_start,
         SUM(CASE WHEN ${stockInTypeSql} THEN sm.quantity ELSE 0 END)::int AS stock_in,
         SUM(CASE WHEN ${stockOutTypeSql} THEN sm.quantity ELSE 0 END)::int AS stock_out
       FROM "stockMovement" sm
       INNER JOIN filtered_products fp
         ON fp.id = sm."productId"
       WHERE sm."organizationId" = $1
       GROUP BY month_key, month_start
       ORDER BY month_start DESC
       LIMIT 12`,
      params
    );

    return json(event, 200, {
      months: result.rows || [],
      filters: {
        scope: scopeFilter,
        category: categoryFilter || "all",
        search: searchFilter,
        stock: stockFilter,
      },
    });
  } catch (err) {
    console.error("stockActivity error", err);
    return json(event, 500, { error: "Failed to fetch stock activity" });
  } finally {
    await client.end().catch(() => {});
  }
}
