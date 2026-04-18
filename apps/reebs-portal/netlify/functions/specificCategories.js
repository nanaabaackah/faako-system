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
} from "./_shared/inventoryExtensions.js";

const METHODS = "GET,POST,OPTIONS";
const SOURCE_CATEGORY_CODE_ALIASES = {
  RENTALS: "RENTAL",
  RENTAL: "RENTAL",
  CLOTHING: "CLOTHES",
  CLOTHES: "CLOTHES",
};
const SOURCE_CATEGORY_CODES_BY_NAME = {
  toys: "TOYS",
  rentals: "RENTAL",
  rental: "RENTAL",
  clothes: "CLOTHES",
  clothing: "CLOTHES",
  shoes: "SHOES",
  supplies: "SUPPLIES",
  household: "HOUSEHOLD",
};

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

const normalizeSourceCategoryCode = (value) => {
  const direct = cleanInventoryText(value, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return SOURCE_CATEGORY_CODE_ALIASES[direct] || direct;
};

const resolveSourceCategoryCode = (category, requestedCode = "") => {
  const direct = normalizeSourceCategoryCode(requestedCode);
  if (direct) return direct;
  const nameKey = cleanInventoryText(category?.name || category?.slug || "", 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return SOURCE_CATEGORY_CODES_BY_NAME[nameKey] || "";
};

const categoryKey = (sourceCode, name) =>
  `${normalizeSourceCategoryCode(sourceCode)}:${cleanInventoryText(name, 120).toLowerCase()}`;

const listSpecificCategories = async (client, organizationId) => {
  const persisted = await client.query(
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
     WHERE c."organizationId" = $1
     ORDER BY c."isActive" DESC, lower(c.name) ASC`,
    [organizationId]
  );

  const productCategories = await client.query(
    `SELECT
       MIN(p.id)::text AS id,
       p."sourceCategoryId",
       COALESCE(p."sourceCategoryCode", '') AS "sourceCategoryCode",
       trim(p."specificCategory") AS name,
       COUNT(p.id)::int AS "itemCount",
       sc.name AS "sourceCategoryName",
       sc.slug AS "sourceCategorySlug"
     FROM "product" p
     LEFT JOIN "sourceCategory" sc
       ON sc.id = p."sourceCategoryId"
      AND sc."organizationId" = p."organizationId"
     WHERE p."organizationId" = $1
       AND COALESCE(p."isDeleted", false) = false
       AND NULLIF(trim(COALESCE(p."specificCategory", '')), '') IS NOT NULL
     GROUP BY
       p."sourceCategoryId",
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

  return Array.from(byKey.values()).sort((a, b) => {
    const sourceCompare = String(a.sourceCategoryCode || "").localeCompare(String(b.sourceCategoryCode || ""));
    if (sourceCompare) return sourceCompare;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (!["GET", "POST"].includes(method)) {
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
      return json(event, 403, { error: "Only owners and admins can manage specific categories." });
    }

    const body = parseBody(event);
    if (!body) return json(event, 400, { error: "Invalid JSON body." });

    const name = cleanInventoryText(body.name, 120);
    if (!name) return json(event, 400, { error: "Specific category name is required." });

    const sourceCategoryId = Number(body.sourceCategoryId ?? body.source_category_id);
    const sourceCategoryName = cleanInventoryText(
      body.sourceCategoryName || body.source_category_name || "",
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
      body.sourceCategoryCode || body.source_category_code || sourceCategoryName
    );
    const created = await createSpecificCategory(client, organizationId, {
      name,
      sourceCategoryId: sourceCategory?.id || null,
      sourceCategoryCode,
    });

    return json(event, 201, {
      ...created,
      sourceCategoryName: sourceCategory?.name || null,
      sourceCategorySlug: sourceCategory?.slug || null,
      itemCount: 0,
    });
  } catch (err) {
    console.error("specificCategories error", err);
    const status = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, status, {
      error: status === 409 ? "A specific category with that name already exists." : "Failed to process specific category.",
      detail: err?.message || null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
