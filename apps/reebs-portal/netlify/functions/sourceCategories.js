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

const METHODS = "GET,POST,PATCH,OPTIONS";

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

const listCategories = async (client, organizationId, { includeInactive = false } = {}) => {
  const result = await client.query(
    `SELECT
       sc.id,
       sc."organizationId",
       sc.name,
       sc.slug,
       sc."isActive",
       sc."createdAt",
       sc."updatedAt",
       COUNT(p.id)::int AS "itemCount"
     FROM "sourceCategory" sc
     LEFT JOIN "product" p
       ON p."sourceCategoryId" = sc.id
      AND p."organizationId" = sc."organizationId"
      AND COALESCE(p."isDeleted", false) = false
     WHERE sc."organizationId" = $1
       ${includeInactive ? "" : `AND sc."isActive" = true`}
     GROUP BY sc.id
     ORDER BY sc."isActive" DESC,
       CASE lower(sc.name)
         WHEN 'toys' THEN 1
         WHEN 'rentals' THEN 2
         WHEN 'rental' THEN 2
         WHEN 'clothes' THEN 3
         WHEN 'shoes' THEN 4
         WHEN 'supplies' THEN 5
         WHEN 'household' THEN 6
         ELSE 99
       END,
       lower(sc.name) ASC`,
    [organizationId]
  );
  return result.rows || [];
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }
  if (!["GET", "POST", "PATCH"].includes(method)) {
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
      return json(event, 403, { error: "Only owners and admins can manage source categories." });
    }

    const body = parseBody(event);
    if (!body) {
      return json(event, 400, { error: "Invalid JSON body." });
    }

    if (method === "POST") {
      const created = await createSourceCategory(client, organizationId, body.name);
      return json(event, 201, created);
    }

    const categoryId = Number(body.id || event.queryStringParameters?.id);
    const existing = await findSourceCategoryById(client, organizationId, categoryId);
    if (!existing) {
      return json(event, 404, { error: "Source category not found." });
    }

    const updates = [];
    const params = [];
    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const name = cleanInventoryText(body.name, 120);
      if (!name) return json(event, 400, { error: "Category name is required." });
      const duplicate = await client.query(
        `SELECT id FROM "sourceCategory"
         WHERE "organizationId" = $1
           AND id <> $2
           AND lower(name) = lower($3)
         LIMIT 1`,
        [organizationId, existing.id, name]
      );
      if (duplicate.rowCount > 0) {
        return json(event, 409, { error: "A category with that name already exists." });
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

    if (!updates.length) {
      return json(event, 400, { error: "No category updates provided." });
    }

    params.push(existing.id, organizationId);
    const result = await client.query(
      `UPDATE "sourceCategory"
       SET ${updates.join(", ")}, "updatedAt" = NOW()
       WHERE id = $${params.length - 1} AND "organizationId" = $${params.length}
       RETURNING id, "organizationId", name, slug, "isActive", "createdAt", "updatedAt"`,
      params
    );

    return json(event, 200, result.rows[0]);
  } catch (err) {
    console.error("sourceCategories error", err);
    const status = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, status, {
      error: status === 409 ? "A category with that name already exists." : "Failed to process source category.",
      detail: err?.message || null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
