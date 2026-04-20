/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import {
  cleanInventoryText,
  createSourceCategory,
  ensureSourceCategorySchema,
  findSourceCategoryById,
  seedDefaultSourceCategories,
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

const isAdmin = (user) => ["owner", "admin"].includes(String(user?.role || "").trim().toLowerCase());

const getProductNameInput = (body = {}) => body.name ?? body.productName ?? body.product_name;

const withProductAliases = (category = {}) => ({
  ...category,
  productId: category.productId ?? category.id ?? null,
  productName: category.productName ?? category.name ?? null,
  productCode: category.productCode ?? category.sourceCategoryCode ?? category.slug ?? null,
});

const listCategories = async (client, organizationId, { includeInactive = false } = {}) => {
  const result = await client.query(
      `SELECT
         sc.id,
         sc."organizationId",
         sc.name,
         sc.slug,
         COALESCE(
           NULLIF((
             SELECT p_code."sourceCategoryCode"
             FROM "product" p_code
             WHERE p_code."organizationId" = sc."organizationId"
               AND COALESCE(p_code."isDeleted", false) = false
               AND NULLIF(trim(COALESCE(p_code."sourceCategoryCode", '')), '') IS NOT NULL
               AND (
                 p_code."sourceCategoryId" = sc.id
                 OR (
                   p_code."sourceCategoryId" IS NULL
                   AND (
                     upper(regexp_replace(COALESCE(NULLIF(sc.slug, ''), sc.name), '[^A-Za-z0-9]+', '_', 'g'))
                       = upper(regexp_replace(COALESCE(p_code."sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g'))
                     OR regexp_replace(
                       upper(regexp_replace(COALESCE(NULLIF(sc.slug, ''), sc.name), '[^A-Za-z0-9]+', '_', 'g')),
                       'S$',
                       ''
                     ) = regexp_replace(
                       upper(regexp_replace(COALESCE(p_code."sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g')),
                       'S$',
                       ''
                     )
                   )
                 )
               )
             GROUP BY p_code."sourceCategoryCode"
             ORDER BY COUNT(*) DESC, MIN(p_code.id) ASC
             LIMIT 1
           ), ''),
           upper(regexp_replace(COALESCE(NULLIF(sc.slug, ''), sc.name), '[^A-Za-z0-9]+', '_', 'g'))
         ) AS "sourceCategoryCode",
         sc."isActive",
         sc."createdAt",
         sc."updatedAt",
         COUNT(p.id)::int AS "itemCount"
       FROM "sourceCategory" sc
       LEFT JOIN "product" p
         ON p."organizationId" = sc."organizationId"
        AND COALESCE(p."isDeleted", false) = false
        AND (
          p."sourceCategoryId" = sc.id
          OR (
            p."sourceCategoryId" IS NULL
            AND NULLIF(trim(COALESCE(p."sourceCategoryCode", '')), '') IS NOT NULL
            AND (
              upper(regexp_replace(COALESCE(NULLIF(sc.slug, ''), sc.name), '[^A-Za-z0-9]+', '_', 'g'))
                = upper(regexp_replace(COALESCE(p."sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g'))
              OR regexp_replace(
                upper(regexp_replace(COALESCE(NULLIF(sc.slug, ''), sc.name), '[^A-Za-z0-9]+', '_', 'g')),
                'S$',
                ''
              ) = regexp_replace(
                upper(regexp_replace(COALESCE(p."sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g')),
                'S$',
                ''
              )
            )
          )
        )
       WHERE sc."organizationId" = $1
         ${includeInactive ? "" : `AND sc."isActive" = true`}
       GROUP BY sc.id
       ORDER BY sc."isActive" DESC,
         lower(sc.name) ASC`,
    [organizationId]
  );
  return (result.rows || []).map(withProductAliases);
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    return json(event, 405, { error: "Method not allowed." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const auth = await requireInternalUser(client, event, { methods: METHODS });
    if (auth.errorResponse) return auth.errorResponse;

    const { authUser, organizationId } = auth;
    await ensureSourceCategorySchema(client);
    await seedDefaultSourceCategories(client, organizationId);

    if (method === "GET") {
      const includeInactive = String(event.queryStringParameters?.includeInactive || "")
        .trim()
        .toLowerCase() === "1";
      const categories = await listCategories(client, organizationId, { includeInactive });
      return json(event, 200, categories);
    }

    if (!isAdmin(authUser)) {
      return json(event, 403, { error: "Only owners and admins can manage products." });
    }

    const body = parseBody(event);
    if (!body) {
      return json(event, 400, { error: "Invalid JSON body." });
    }

    if (method === "POST") {
      const created = await createSourceCategory(client, organizationId, getProductNameInput(body));
      return json(event, 201, withProductAliases(created));
    }

    const categoryId = Number(body.id || event.queryStringParameters?.id);
    const existing = await findSourceCategoryById(client, organizationId, categoryId);
    if (!existing) {
      return json(event, 404, { error: "Product not found." });
    }

    if (method === "DELETE") {
      const moveItemsTo = Number(body.moveItemsTo || 0);
      if (moveItemsTo && moveItemsTo > 0) {
        const targetCategory = await findSourceCategoryById(client, organizationId, moveItemsTo);
        if (!targetCategory) {
          return json(event, 404, { error: "Target product not found for item reassignment." });
        }
        await client.query(
          `UPDATE "product"
           SET "sourceCategoryId" = $1, "updatedAt" = NOW()
           WHERE "organizationId" = $2
             AND (
               "sourceCategoryId" = $3
               OR (
                 "sourceCategoryId" IS NULL
                 AND NULLIF(trim(COALESCE("sourceCategoryCode", '')), '') IS NOT NULL
                 AND (
                   upper(regexp_replace(COALESCE(NULLIF($4, ''), $5), '[^A-Za-z0-9]+', '_', 'g'))
                     = upper(regexp_replace(COALESCE("sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g'))
                   OR regexp_replace(
                     upper(regexp_replace(COALESCE(NULLIF($4, ''), $5), '[^A-Za-z0-9]+', '_', 'g')),
                     'S$',
                     ''
                   ) = regexp_replace(
                     upper(regexp_replace(COALESCE("sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g')),
                     'S$',
                     ''
                   )
                 )
               )
             )`,
          [
            moveItemsTo,
            organizationId,
            existing.id,
            existing.slug || "",
            existing.name,
          ]
        );
      }
      await client.query(
        `DELETE FROM "sourceCategory" WHERE id = $1 AND "organizationId" = $2`,
        [existing.id, organizationId]
      );
      return json(event, 200, { success: true, message: "Product deleted successfully." });
    }

    const updates = [];
    const params = [];
    if (
      Object.prototype.hasOwnProperty.call(body, "name")
      || Object.prototype.hasOwnProperty.call(body, "productName")
      || Object.prototype.hasOwnProperty.call(body, "product_name")
    ) {
      const name = cleanInventoryText(getProductNameInput(body), 120);
      if (!name) return json(event, 400, { error: "Product name is required." });
      const duplicate = await client.query(
        `SELECT id FROM "sourceCategory"
         WHERE "organizationId" = $1
           AND id <> $2
           AND lower(name) = lower($3)
         LIMIT 1`,
        [organizationId, existing.id, name]
      );
      if (duplicate.rowCount > 0) {
        return json(event, 409, { error: "A product with that name already exists." });
      }
      params.push(name);
      updates.push(`name = $${params.length}`);
      params.push(slugifySourceCategory(name));
      updates.push(`slug = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      params.push(Boolean(body.isActive));
      updates.push(`"isActive" = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(body, "moveItemsTo")) {
      params.push(Number(body.moveItemsTo));
      updates.push(`"sourceCategoryId" = $${params.length}`);
    }

    if (!updates.length) {
      return json(event, 400, { error: "No product updates provided." });
    }

    params.push(existing.id, organizationId);
    const result = await client.query(
      `UPDATE "sourceCategory"
       SET ${updates.join(", ")}, "updatedAt" = NOW()
       WHERE id = $${params.length - 1} AND "organizationId" = $${params.length}
       RETURNING id, "organizationId", name, slug, "isActive", "createdAt", "updatedAt"`,
      params
    );

    return json(event, 200, withProductAliases(result.rows[0]));
  } catch (err) {
    console.error("sourceCategories error", err);
    const status = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, status, {
      error: status === 409 ? "A product with that name already exists." : "Failed to process product.",
      detail: err?.message || null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
