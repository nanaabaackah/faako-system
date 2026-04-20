/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import {
  cleanInventoryText,
  createSpecificCategory,
  ensureSpecificCategorySchema,
  findSourceCategoryById,
  findSourceCategoryByName,
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

const getCategoryNameInput = (body = {}) =>
  body.name ?? body.categoryName ?? body.category_name ?? body.category ?? body.inventoryCategory;

const getProductIdInput = (body = {}) =>
  body.sourceCategoryId ?? body.source_category_id ?? body.productId ?? body.product_id;

const getProductNameInput = (body = {}) =>
  body.sourceCategoryName ?? body.source_category_name ?? body.productName ?? body.product_name;

const getProductCodeInput = (body = {}) =>
  body.sourceCategoryCode ?? body.source_category_code ?? body.productCode ?? body.product_code;

const withCategoryAliases = (category = {}) => ({
  ...category,
  productId: category.productId ?? category.sourceCategoryId ?? null,
  productName: category.productName ?? category.sourceCategoryName ?? null,
  productCode: category.productCode ?? category.sourceCategoryCode ?? null,
  categoryName: category.categoryName ?? category.name ?? null,
  category: category.category ?? category.name ?? null,
  inventoryCategory: category.inventoryCategory ?? category.name ?? null,
});

const normalizeSourceCategoryCode = (value) => {
  return cleanInventoryText(value, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const resolveSourceCategoryCode = (category, requestedCode = "") => {
  const direct = normalizeSourceCategoryCode(requestedCode);
  if (direct) return direct;
  return normalizeSourceCategoryCode(category?.sourceCategoryCode || category?.slug || category?.name);
};

const categoryKey = (sourceCode, name) =>
  `${normalizeSourceCategoryCode(sourceCode)}:${cleanInventoryText(name, 120).toLowerCase()}`;

const listSpecificCategories = async (client, organizationId) => {
  const persisted = await client.query(
    `SELECT
       c.id,
       c."organizationId",
       COALESCE(c."sourceCategoryId", sc.id) AS "sourceCategoryId",
       c."sourceCategoryCode",
       c.name,
       c.slug,
       c."isActive",
       c."createdAt",
       c."updatedAt",
       sc.name AS "sourceCategoryName",
       sc.slug AS "sourceCategorySlug"
     FROM "specificCategory" c
     LEFT JOIN LATERAL (
       SELECT sc_match.id, sc_match.name, sc_match.slug
       FROM "sourceCategory" sc_match
       WHERE sc_match."organizationId" = c."organizationId"
         AND (
           sc_match.id = c."sourceCategoryId"
           OR (
             c."sourceCategoryId" IS NULL
             AND NULLIF(trim(COALESCE(c."sourceCategoryCode", '')), '') IS NOT NULL
             AND (
               upper(regexp_replace(COALESCE(NULLIF(sc_match.slug, ''), sc_match.name), '[^A-Za-z0-9]+', '_', 'g'))
                 = upper(regexp_replace(COALESCE(c."sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g'))
               OR regexp_replace(
                 upper(regexp_replace(COALESCE(NULLIF(sc_match.slug, ''), sc_match.name), '[^A-Za-z0-9]+', '_', 'g')),
                 'S$',
                 ''
               ) = regexp_replace(
                 upper(regexp_replace(COALESCE(c."sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g')),
                 'S$',
                 ''
               )
             )
           )
         )
       ORDER BY
         CASE WHEN sc_match.id = c."sourceCategoryId" THEN 0 ELSE 1 END,
         sc_match."isActive" DESC,
         sc_match.id ASC
       LIMIT 1
     ) sc ON true
     WHERE c."organizationId" = $1
     ORDER BY c."isActive" DESC, lower(c.name) ASC`,
    [organizationId]
  );

  const productCategories = await client.query(
    `SELECT
       MIN(p.id)::text AS id,
       COALESCE(p."sourceCategoryId", sc.id) AS "sourceCategoryId",
       COALESCE(p."sourceCategoryCode", '') AS "sourceCategoryCode",
       trim(p."specificCategory") AS name,
       COUNT(p.id)::int AS "itemCount",
       sc.name AS "sourceCategoryName",
       sc.slug AS "sourceCategorySlug"
     FROM "product" p
     LEFT JOIN LATERAL (
       SELECT sc_match.id, sc_match.name, sc_match.slug
       FROM "sourceCategory" sc_match
       WHERE sc_match."organizationId" = p."organizationId"
         AND (
           sc_match.id = p."sourceCategoryId"
           OR (
             p."sourceCategoryId" IS NULL
             AND NULLIF(trim(COALESCE(p."sourceCategoryCode", '')), '') IS NOT NULL
             AND (
               upper(regexp_replace(COALESCE(NULLIF(sc_match.slug, ''), sc_match.name), '[^A-Za-z0-9]+', '_', 'g'))
                 = upper(regexp_replace(COALESCE(p."sourceCategoryCode", ''), '[^A-Za-z0-9]+', '_', 'g'))
               OR regexp_replace(
                 upper(regexp_replace(COALESCE(NULLIF(sc_match.slug, ''), sc_match.name), '[^A-Za-z0-9]+', '_', 'g')),
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
       ORDER BY
         CASE WHEN sc_match.id = p."sourceCategoryId" THEN 0 ELSE 1 END,
         sc_match."isActive" DESC,
         sc_match.id ASC
       LIMIT 1
     ) sc ON true
     WHERE p."organizationId" = $1
       AND COALESCE(p."isDeleted", false) = false
       AND NULLIF(trim(COALESCE(p."specificCategory", '')), '') IS NOT NULL
     GROUP BY
       COALESCE(p."sourceCategoryId", sc.id),
       COALESCE(p."sourceCategoryCode", ''),
       trim(p."specificCategory"),
       sc.name,
       sc.slug`,
    [organizationId]
  );

  const byKey = new Map();
  persisted.rows.forEach((row) => {
    const sourceCode = resolveSourceCategoryCode(
      { name: row.sourceCategoryName, slug: row.sourceCategorySlug },
      row.sourceCategoryCode
    );
    byKey.set(categoryKey(sourceCode, row.name), {
      ...row,
      sourceCategoryCode: sourceCode,
      itemCount: 0,
      source: "specificCategory",
    });
  });

  productCategories.rows.forEach((row) => {
    const sourceCode = resolveSourceCategoryCode(
      { name: row.sourceCategoryName, slug: row.sourceCategorySlug },
      row.sourceCategoryCode
    );
    const key = categoryKey(sourceCode, row.name);
    const current = byKey.get(key);
    if (current) {
      byKey.set(key, {
        ...current,
        itemCount: Number(row.itemCount) || 0,
        sourceCategoryId: current.sourceCategoryId || row.sourceCategoryId || null,
        sourceCategoryName: current.sourceCategoryName || row.sourceCategoryName || null,
        sourceCategorySlug: current.sourceCategorySlug || row.sourceCategorySlug || null,
      });
      return;
    }
    byKey.set(key, {
      id: `product:${row.id}`,
      organizationId,
      sourceCategoryId: row.sourceCategoryId || null,
      sourceCategoryCode: sourceCode,
      name: row.name,
      slug: cleanInventoryText(row.name, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      isActive: true,
      createdAt: null,
      updatedAt: null,
      itemCount: Number(row.itemCount) || 0,
      sourceCategoryName: row.sourceCategoryName || null,
      sourceCategorySlug: row.sourceCategorySlug || null,
      source: "product",
    });
  });

  return Array.from(byKey.values()).map(withCategoryAliases).sort((a, b) => {
    const sourceCompare = String(a.sourceCategoryCode || "").localeCompare(String(b.sourceCategoryCode || ""));
    if (sourceCompare) return sourceCompare;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
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
    const auth = await requireInternalUser(client, event, { methods: METHODS });
    if (auth.errorResponse) return auth.errorResponse;

    const { authUser, organizationId } = auth;
    await ensureSpecificCategorySchema(client);
    await seedDefaultSourceCategories(client, organizationId);

    if (method === "GET") {
      const categories = await listSpecificCategories(client, organizationId);
      return json(event, 200, categories);
    }

    if (!isAdmin(authUser)) {
      return json(event, 403, { error: "Only owners and admins can manage categories." });
    }

    const body = parseBody(event);
    if (!body) return json(event, 400, { error: "Invalid JSON body." });

    if (method === "POST") {
      const name = cleanInventoryText(getCategoryNameInput(body), 120);
      if (!name) return json(event, 400, { error: "Category name is required." });

      const sourceCategoryId = Number(getProductIdInput(body));
      const sourceCategoryName = cleanInventoryText(
        getProductNameInput(body) || "",
        120
      );
      let sourceCategory = Number.isFinite(sourceCategoryId) && sourceCategoryId > 0
        ? await findSourceCategoryById(client, organizationId, sourceCategoryId)
        : null;
      if (!sourceCategory && sourceCategoryName) {
        sourceCategory = await findSourceCategoryByName(client, organizationId, sourceCategoryName);
      }

      const sourceCategoryCode = resolveSourceCategoryCode(
        sourceCategory,
        getProductCodeInput(body) || sourceCategoryName
      );
      const created = await createSpecificCategory(client, organizationId, {
        name,
        sourceCategoryId: sourceCategory?.id || null,
        sourceCategoryCode,
      });

      return json(event, 201, withCategoryAliases({
        ...created,
        sourceCategoryName: sourceCategory?.name || null,
        sourceCategorySlug: sourceCategory?.slug || null,
        itemCount: 0,
      }));
    }

    const categoryId = Number(body.id || event.queryStringParameters?.id);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      return json(event, 400, { error: "Category id is required." });
    }

    const existingResult = await client.query(
      `SELECT
         c.id,
         c."organizationId",
         c."sourceCategoryId",
         c."sourceCategoryCode",
         c.name,
         c.slug,
         c."isActive",
         c."createdAt",
         c."updatedAt",
         sc.name AS "sourceCategoryName",
         sc.slug AS "sourceCategorySlug"
       FROM "specificCategory" c
       LEFT JOIN "sourceCategory" sc
         ON sc.id = c."sourceCategoryId"
        AND sc."organizationId" = c."organizationId"
       WHERE c.id = $1
         AND c."organizationId" = $2
       LIMIT 1`,
      [categoryId, organizationId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      return json(event, 404, { error: "Category not found." });
    }

    if (method === "DELETE") {
      const moveItemsTo = Number(body.moveItemsTo || 0);
      if (moveItemsTo && moveItemsTo > 0) {
        const targetResult = await client.query(
          `SELECT id, name, slug, "sourceCategoryId", "sourceCategoryCode"
           FROM "specificCategory"
           WHERE id = $1 AND "organizationId" = $2
           LIMIT 1`,
          [moveItemsTo, organizationId]
        );
        const targetCategory = targetResult.rows[0];
        if (!targetCategory) {
          return json(event, 404, { error: "Target category not found for item reassignment." });
        }
        await client.query(
          `UPDATE "product"
           SET "specificCategory" = $1, "updatedAt" = NOW()
           WHERE "organizationId" = $2
             AND COALESCE("specificCategory", '') = $3`,
          [targetCategory.name, organizationId, existing.name]
        );
      }
      await client.query(
        `DELETE FROM "specificCategory" WHERE id = $1 AND "organizationId" = $2`,
        [existing.id, organizationId]
      );
      return json(event, 200, { success: true, message: "Category deleted successfully." });
    }

    const hasSourceUpdate = [
      "sourceCategoryId",
      "source_category_id",
      "sourceCategoryName",
      "source_category_name",
      "sourceCategoryCode",
      "source_category_code",
      "productId",
      "product_id",
      "productName",
      "product_name",
      "productCode",
      "product_code",
    ].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    const sourceCategoryId = Number(getProductIdInput(body));
    const sourceCategoryName = cleanInventoryText(
      getProductNameInput(body) || "",
      120
    );
    let sourceCategory = null;
    if (hasSourceUpdate) {
      sourceCategory = Number.isFinite(sourceCategoryId) && sourceCategoryId > 0
        ? await findSourceCategoryById(client, organizationId, sourceCategoryId)
        : null;
      if (!sourceCategory && sourceCategoryName) {
        sourceCategory = await findSourceCategoryByName(client, organizationId, sourceCategoryName);
      }
      if (!sourceCategory && !cleanInventoryText(getProductCodeInput(body) || "", 40)) {
        return json(event, 400, { error: "Choose an existing product." });
      }
    }

    const hasNameUpdate = [
      "name",
      "categoryName",
      "category_name",
      "category",
      "inventoryCategory",
    ].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    const nextName = hasNameUpdate
      ? cleanInventoryText(getCategoryNameInput(body), 120)
      : existing.name;
    if (!nextName) {
      return json(event, 400, { error: "Category name is required." });
    }
    const nextSourceCategoryCode = hasSourceUpdate
      ? resolveSourceCategoryCode(
        sourceCategory,
        getProductCodeInput(body) || sourceCategoryName
      )
      : resolveSourceCategoryCode(
        { name: existing.sourceCategoryName, slug: existing.sourceCategorySlug },
        existing.sourceCategoryCode
      );

    if (
      hasNameUpdate
      || hasSourceUpdate
    ) {
      const duplicate = await client.query(
        `SELECT id
         FROM "specificCategory"
         WHERE "organizationId" = $1
           AND id <> $2
           AND COALESCE("sourceCategoryCode", '') = $3
           AND lower(name) = lower($4)
         LIMIT 1`,
        [organizationId, existing.id, nextSourceCategoryCode || "", nextName]
      );
      if (duplicate.rowCount > 0) {
        return json(event, 409, { error: "A category with that name already exists for this product." });
      }
    }

    const updates = [];
    const params = [];
    if (hasNameUpdate) {
      params.push(nextName);
      updates.push(`name = $${params.length}`);
      params.push(slugifySourceCategory(nextName));
      updates.push(`slug = $${params.length}`);
    }
    if (hasSourceUpdate) {
      params.push(sourceCategory?.id || null);
      updates.push(`"sourceCategoryId" = $${params.length}`);
      params.push(nextSourceCategoryCode || null);
      updates.push(`"sourceCategoryCode" = $${params.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      params.push(Boolean(body.isActive));
      updates.push(`"isActive" = $${params.length}`);
    }
    if (!updates.length) {
      return json(event, 400, { error: "No category updates provided." });
    }

    params.push(existing.id, organizationId);
    const result = await client.query(
      `UPDATE "specificCategory"
       SET ${updates.join(", ")}, "updatedAt" = NOW()
       WHERE id = $${params.length - 1}
         AND "organizationId" = $${params.length}
       RETURNING
         id,
         "organizationId",
         "sourceCategoryId",
         "sourceCategoryCode",
         name,
         slug,
         "isActive",
         "createdAt",
         "updatedAt"`,
      params
    );
    const updated = result.rows[0];
    const resolvedSourceCategory = hasSourceUpdate
      ? sourceCategory
      : {
        name: existing.sourceCategoryName,
        slug: existing.sourceCategorySlug,
      };

    return json(event, 200, withCategoryAliases({
      ...updated,
      sourceCategoryName: resolvedSourceCategory?.name || null,
      sourceCategorySlug: resolvedSourceCategory?.slug || null,
      itemCount: 0,
    }));
  } catch (err) {
    console.error("specificCategories error", err);
    const status = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, status, {
      error: status === 409 ? "A category with that name already exists." : "Failed to process category.",
      detail: err?.message || null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
