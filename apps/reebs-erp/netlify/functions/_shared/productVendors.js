const linkTableStatements = [
  `CREATE TABLE IF NOT EXISTS "productVendorLink" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "productId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "productVendorLink_org_product_vendor_unique"
    ON "productVendorLink" ("organizationId", "productId", "vendorId")`,
  `CREATE INDEX IF NOT EXISTS "productVendorLink_org_product_idx"
    ON "productVendorLink" ("organizationId", "productId")`,
  `CREATE INDEX IF NOT EXISTS "productVendorLink_org_vendor_idx"
    ON "productVendorLink" ("organizationId", "vendorId")`,
];

export const ensureProductVendorLinksTable = async (client) => {
  for (const statement of linkTableStatements) {
    try {
      await client.query(statement);
    } catch (error) {
      console.warn("Product vendor link check failed:", error?.message || error);
    }
  }
};

export const backfillProductVendorLinksFromProducts = async (client, organizationId = null) => {
  const params = [];
  const where = [`p."vendorId" IS NOT NULL`];
  if (Number.isFinite(Number(organizationId)) && Number(organizationId) > 0) {
    params.push(Number(organizationId));
    where.push(`p."organizationId" = $${params.length}`);
  }

  await client.query(
    `INSERT INTO "productVendorLink" (
      "organizationId",
      "productId",
      "vendorId",
      "isPrimary",
      "createdAt",
      "updatedAt"
    )
    SELECT
      COALESCE(p."organizationId", 1),
      p.id,
      p."vendorId",
      true,
      NOW(),
      NOW()
    FROM "product" p
    WHERE ${where.join(" AND ")}
    ON CONFLICT ("organizationId", "productId", "vendorId") DO UPDATE
    SET "isPrimary" = EXCLUDED."isPrimary",
        "updatedAt" = NOW()`,
    params
  );
};

export const parseVendorIdsInput = (value) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string" && value.includes(",")
      ? value.split(",")
      : [value];

  const unique = new Set();
  const vendorIds = [];
  let invalid = false;

  for (const entry of values) {
    if (entry === "" || entry === null || typeof entry === "undefined") continue;
    const parsed = Number(entry);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      invalid = true;
      continue;
    }
    const normalized = Math.round(parsed);
    if (unique.has(normalized)) continue;
    unique.add(normalized);
    vendorIds.push(normalized);
  }

  return { vendorIds, invalid };
};

export const getProductVendorIdsMap = async (
  client,
  {
    organizationId,
    productIds = [],
  }
) => {
  const normalizedProductIds = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value))
    )
  );

  const map = new Map();
  if (!normalizedProductIds.length) return map;

  const result = await client.query(
    `SELECT
       "productId",
       ARRAY_AGG("vendorId" ORDER BY "isPrimary" DESC, "vendorId" ASC) AS "vendorIds"
     FROM "productVendorLink"
     WHERE "organizationId" = $1
       AND "productId" = ANY($2::int[])
     GROUP BY "productId"`,
    [organizationId, normalizedProductIds]
  );

  for (const row of result.rows || []) {
    map.set(
      Number(row.productId),
      Array.isArray(row.vendorIds)
        ? row.vendorIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
        : []
    );
  }

  return map;
};

export const getVendorProductSummaries = async (
  client,
  {
    organizationId,
    vendorIds = [],
  }
) => {
  const normalizedVendorIds = Array.from(
    new Set(
      (Array.isArray(vendorIds) ? vendorIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value))
    )
  );

  const map = new Map();
  if (!normalizedVendorIds.length) return map;

  const result = await client.query(
    `SELECT
       l."vendorId" AS "vendorId",
       COUNT(DISTINCT l."productId")::int AS "productCount",
       COALESCE(
         ARRAY_AGG(DISTINCT p.name ORDER BY p.name)
           FILTER (WHERE p.name IS NOT NULL AND BTRIM(p.name) <> ''),
         '{}'::text[]
       ) AS "productNames"
     FROM "productVendorLink" l
     LEFT JOIN "product" p
       ON p.id = l."productId"
      AND p."organizationId" = l."organizationId"
     WHERE l."organizationId" = $1
       AND l."vendorId" = ANY($2::int[])
     GROUP BY l."vendorId"`,
    [organizationId, normalizedVendorIds]
  );

  for (const row of result.rows || []) {
    map.set(Number(row.vendorId), {
      products: Number(row.productCount || 0),
      productNames: Array.isArray(row.productNames) ? row.productNames.filter(Boolean) : [],
    });
  }

  return map;
};

export const setProductVendorLinks = async (
  client,
  {
    organizationId,
    productId,
    vendorIds = [],
  }
) => {
  const parsedProductId = Number(productId);
  const { vendorIds: normalizedVendorIds } = parseVendorIdsInput(vendorIds);
  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    return [];
  }

  const primaryVendorId = normalizedVendorIds[0] || null;

  if (normalizedVendorIds.length) {
    await client.query(
      `DELETE FROM "productVendorLink"
       WHERE "organizationId" = $1
         AND "productId" = $2
         AND NOT ("vendorId" = ANY($3::int[]))`,
      [organizationId, parsedProductId, normalizedVendorIds]
    );

    await client.query(
      `INSERT INTO "productVendorLink" (
        "organizationId",
        "productId",
        "vendorId",
        "isPrimary",
        "createdAt",
        "updatedAt"
      )
      SELECT
        $1,
        $2,
        linked_vendor_id,
        linked_vendor_id = $4,
        NOW(),
        NOW()
      FROM UNNEST($3::int[]) AS linked_vendor_id
      ON CONFLICT ("organizationId", "productId", "vendorId") DO UPDATE
      SET "isPrimary" = EXCLUDED."isPrimary",
          "updatedAt" = NOW()`,
      [organizationId, parsedProductId, normalizedVendorIds, primaryVendorId]
    );

    await client.query(
      `UPDATE "productVendorLink"
       SET "isPrimary" = false,
           "updatedAt" = NOW()
       WHERE "organizationId" = $1
         AND "productId" = $2
         AND "vendorId" <> $3
         AND "isPrimary" = true`,
      [organizationId, parsedProductId, primaryVendorId]
    );
  } else {
    await client.query(
      `DELETE FROM "productVendorLink"
       WHERE "organizationId" = $1
         AND "productId" = $2`,
      [organizationId, parsedProductId]
    );
  }

  await client.query(
    `UPDATE "product"
     SET "vendorId" = $3,
         "updatedAt" = NOW()
     WHERE id = $1
       AND "organizationId" = $2`,
    [parsedProductId, organizationId, primaryVendorId]
  );

  return normalizedVendorIds;
};
