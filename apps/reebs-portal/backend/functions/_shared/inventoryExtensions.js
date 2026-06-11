export const DEFAULT_SOURCE_CATEGORIES = [
  { name: "Toys", slug: "toys" },
  { name: "Rentals", slug: "rentals" },
  { name: "Clothes", slug: "clothes" },
  { name: "Shoes", slug: "shoes" },
  { name: "Supplies", slug: "supplies" },
  { name: "Household", slug: "household" },
];

export const INVENTORY_ITEM_TYPES = new Set(["STANDARD", "VARIANT_PARENT", "BUNDLE"]);

export const cleanInventoryText = (value, max = 160) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
};

export const slugifySourceCategory = (value) => {
  const slug = cleanInventoryText(value, 120)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return slug || "category";
};

export const normalizeInventoryItemType = (value, fallback = "STANDARD") => {
  const normalized = cleanInventoryText(value, 32).toUpperCase();
  return INVENTORY_ITEM_TYPES.has(normalized) ? normalized : fallback;
};

const runStatements = async (client, statements, label) => {
  for (const statement of statements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn(`${label} failed:`, err?.message || err);
    }
  }
};

const normalizeDefaultSourceCategories = async (client, organizationId) => {
  const parsedOrgId = Number(organizationId);
  if (!Number.isFinite(parsedOrgId) || parsedOrgId <= 0) return;

  try {
    const canonicalRentals = await client.query(
      `SELECT id
       FROM "sourceCategory"
       WHERE "organizationId" = $1
         AND (lower(name) = 'rentals' OR lower(slug) = 'rentals')
       ORDER BY id
       LIMIT 1`,
      [parsedOrgId]
    );
    const legacyRental = await client.query(
      `SELECT id
       FROM "sourceCategory"
       WHERE "organizationId" = $1
         AND (lower(name) = 'rental' OR lower(slug) = 'rental')
       ORDER BY id
       LIMIT 1`,
      [parsedOrgId]
    );

    const canonicalId = canonicalRentals.rows[0]?.id;
    const legacyId = legacyRental.rows[0]?.id;
    if (!legacyId) return;

    if (canonicalId) {
      await client.query(
        `UPDATE "product"
         SET "sourceCategoryId" = $1
         WHERE "organizationId" = $3
           AND "sourceCategoryId" = $2`,
        [canonicalId, legacyId, parsedOrgId]
      );
      await client.query(
        `UPDATE "sourceCategory"
         SET "isActive" = false,
             "updatedAt" = NOW()
         WHERE id = $1
           AND "organizationId" = $2`,
        [legacyId, parsedOrgId]
      );
      return;
    }

    await client.query(
      `UPDATE "sourceCategory"
       SET name = 'Rentals',
           slug = 'rentals',
           "isActive" = true,
           "updatedAt" = NOW()
       WHERE id = $1
         AND "organizationId" = $2`,
      [legacyId, parsedOrgId]
    );
  } catch (err) {
    console.warn("Product normalization failed:", err?.message || err);
  }
};

export const ensureSourceCategorySchema = async (client) => {
  await runStatements(
    client,
    [
      `CREATE TABLE IF NOT EXISTS "sourceCategory" (
        "id" SERIAL PRIMARY KEY,
        "organizationId" INTEGER NOT NULL DEFAULT 1,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "sourceCategory_organizationId_isActive_idx"
        ON "sourceCategory" ("organizationId", "isActive")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "sourceCategory_org_name_ci_key"
        ON "sourceCategory" ("organizationId", lower("name"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "sourceCategory_org_slug_ci_key"
        ON "sourceCategory" ("organizationId", lower("slug"))`,
      `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'STANDARD'`,
      `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "sourceCategoryId" INTEGER`,
      `CREATE INDEX IF NOT EXISTS "product_sourceCategoryId_idx" ON "product" ("sourceCategoryId")`,
      `CREATE INDEX IF NOT EXISTS "product_organizationId_itemType_idx"
        ON "product" ("organizationId", "itemType")`,
    ],
    "Product schema check"
  );

  await normalizeDefaultSourceCategories(client, 1);
  for (const category of DEFAULT_SOURCE_CATEGORIES) {
    await client.query(
      `INSERT INTO "sourceCategory" ("organizationId", "name", "slug", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [1, category.name, category.slug]
    ).catch(() => {});
  }
};

export const seedDefaultSourceCategories = async (client, organizationId) => {
  const parsedOrgId = Number(organizationId);
  if (!Number.isFinite(parsedOrgId) || parsedOrgId <= 0) return;
  await ensureSourceCategorySchema(client);
  await normalizeDefaultSourceCategories(client, parsedOrgId);
  for (const category of DEFAULT_SOURCE_CATEGORIES) {
    await client.query(
      `INSERT INTO "sourceCategory" ("organizationId", "name", "slug", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [parsedOrgId, category.name, category.slug]
    );
  }
};

export const ensureSpecificCategorySchema = async (client) => {
  await ensureSourceCategorySchema(client);
  await runStatements(
    client,
    [
      `CREATE TABLE IF NOT EXISTS "specificCategory" (
        "id" SERIAL PRIMARY KEY,
        "organizationId" INTEGER NOT NULL DEFAULT 1,
        "sourceCategoryId" INTEGER,
        "sourceCategoryCode" TEXT,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE "specificCategory" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE "specificCategory" ADD COLUMN IF NOT EXISTS "sourceCategoryId" INTEGER`,
      `ALTER TABLE "specificCategory" ADD COLUMN IF NOT EXISTS "sourceCategoryCode" TEXT`,
      `ALTER TABLE "specificCategory" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
      `CREATE INDEX IF NOT EXISTS "specificCategory_organization_source_idx"
        ON "specificCategory" ("organizationId", "sourceCategoryCode", "isActive")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "specificCategory_org_source_name_ci_key"
        ON "specificCategory" ("organizationId", COALESCE("sourceCategoryCode", ''), lower("name"))`,
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'specificCategory_sourceCategoryId_fkey'
         ) THEN
           ALTER TABLE "specificCategory"
             ADD CONSTRAINT "specificCategory_sourceCategoryId_fkey"
             FOREIGN KEY ("sourceCategoryId") REFERENCES "sourceCategory"("id")
             ON DELETE SET NULL ON UPDATE CASCADE;
         END IF;
       END $$`,
    ],
    "Category schema check"
  );
};

export const ensureInventoryVariantSchema = async (client) => {
  await ensureSpecificCategorySchema(client);
  await runStatements(
    client,
    [
      `CREATE TABLE IF NOT EXISTS "inventoryVariant" (
        "id" SERIAL PRIMARY KEY,
        "organizationId" INTEGER NOT NULL DEFAULT 1,
        "inventoryItemId" INTEGER NOT NULL,
        "sku" TEXT NOT NULL,
        "variantName" TEXT,
        "variantNumber" TEXT,
        "color" TEXT,
        "size" TEXT,
        "stockQty" INTEGER NOT NULL DEFAULT 0,
        "reservedQty" INTEGER NOT NULL DEFAULT 0,
        "reorderLevel" INTEGER NOT NULL DEFAULT 2,
        "priceOverride" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE "inventoryVariant" ADD COLUMN IF NOT EXISTS "variantName" TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "inventoryVariant_organizationId_sku_key"
        ON "inventoryVariant" ("organizationId", "sku")`,
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM pg_indexes
           WHERE schemaname = current_schema()
             AND indexname = 'inventoryVariant_org_item_dimensions_key'
             AND indexdef NOT LIKE '%variantName%'
         ) THEN
           DROP INDEX IF EXISTS "inventoryVariant_org_item_dimensions_key";
         END IF;
       END $$`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "inventoryVariant_org_item_dimensions_key"
        ON "inventoryVariant" (
          "organizationId",
          "inventoryItemId",
          COALESCE("variantName", ''),
          COALESCE("variantNumber", ''),
          COALESCE("color", ''),
          COALESCE("size", '')
        )`,
      `CREATE INDEX IF NOT EXISTS "inventoryVariant_organizationId_inventoryItemId_idx"
        ON "inventoryVariant" ("organizationId", "inventoryItemId")`,
      `ALTER TABLE "orderItem" ADD COLUMN IF NOT EXISTS "variantId" INTEGER`,
      `ALTER TABLE "bookingItem" ADD COLUMN IF NOT EXISTS "variantId" INTEGER`,
      `ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "variantId" INTEGER`,
      `CREATE INDEX IF NOT EXISTS "orderItem_variantId_idx" ON "orderItem" ("variantId")`,
      `CREATE INDEX IF NOT EXISTS "bookingItem_variantId_idx" ON "bookingItem" ("variantId")`,
      `CREATE INDEX IF NOT EXISTS "stockMovement_variantId_idx" ON "stockMovement" ("variantId")`,
    ],
    "Inventory variant schema check"
  );
};

export const findSourceCategoryById = async (client, organizationId, id) => {
  const parsedId = Number(id);
  if (!Number.isFinite(parsedId) || parsedId <= 0) return null;
  const result = await client.query(
    `SELECT id, "organizationId", name, slug, "isActive", "createdAt", "updatedAt"
     FROM "sourceCategory"
     WHERE id = $1 AND "organizationId" = $2
     LIMIT 1`,
    [parsedId, organizationId]
  );
  return result.rows[0] || null;
};

export const findSourceCategoryByName = async (client, organizationId, name) => {
  const cleaned = cleanInventoryText(name, 120);
  if (!cleaned) return null;
  const result = await client.query(
    `SELECT id, "organizationId", name, slug, "isActive", "createdAt", "updatedAt"
     FROM "sourceCategory"
     WHERE "organizationId" = $1 AND lower(name) = lower($2)
     LIMIT 1`,
    [organizationId, cleaned]
  );
  return result.rows[0] || null;
};

export const createSourceCategory = async (client, organizationId, name) => {
  await ensureSourceCategorySchema(client);
  const cleaned = cleanInventoryText(name, 120);
  if (!cleaned) {
    const error = new Error("Category name is required.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await findSourceCategoryByName(client, organizationId, cleaned);
  if (existing) return existing;

  const baseSlug = slugifySourceCategory(cleaned);
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const slugRes = await client.query(
      `SELECT id FROM "sourceCategory"
       WHERE "organizationId" = $1 AND lower(slug) = lower($2)
       LIMIT 1`,
      [organizationId, slug]
    );
    if (slugRes.rowCount === 0) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const result = await client.query(
    `INSERT INTO "sourceCategory" ("organizationId", name, slug, "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, NOW(), NOW())
     RETURNING id, "organizationId", name, slug, "isActive", "createdAt", "updatedAt"`,
    [organizationId, cleaned, slug]
  );
  return result.rows[0];
};

export const findSpecificCategoryByName = async (
  client,
  organizationId,
  { name, sourceCategoryCode = "" } = {}
) => {
  const cleaned = cleanInventoryText(name, 120);
  const sourceCode = cleanInventoryText(sourceCategoryCode, 40).toUpperCase();
  if (!cleaned) return null;
  await ensureSpecificCategorySchema(client);
  const result = await client.query(
    `SELECT
       id,
       "organizationId",
       "sourceCategoryId",
       "sourceCategoryCode",
       name,
       slug,
       "isActive",
       "createdAt",
       "updatedAt"
     FROM "specificCategory"
     WHERE "organizationId" = $1
       AND COALESCE("sourceCategoryCode", '') = $2
       AND lower(name) = lower($3)
     LIMIT 1`,
    [organizationId, sourceCode, cleaned]
  );
  return result.rows[0] || null;
};

export const createSpecificCategory = async (
  client,
  organizationId,
  { name, sourceCategoryId = null, sourceCategoryCode = "" } = {}
) => {
  await ensureSpecificCategorySchema(client);
  const cleaned = cleanInventoryText(name, 120);
  if (!cleaned) {
    const error = new Error("Category name is required.");
    error.statusCode = 400;
    throw error;
  }

  const sourceCode = cleanInventoryText(sourceCategoryCode, 40).toUpperCase();
  const existing = await findSpecificCategoryByName(client, organizationId, {
    name: cleaned,
    sourceCategoryCode: sourceCode,
  });
  if (existing) return existing;

  const parsedSourceCategoryId = Number(sourceCategoryId);
  const safeSourceCategoryId =
    Number.isFinite(parsedSourceCategoryId) && parsedSourceCategoryId > 0
      ? parsedSourceCategoryId
      : null;
  const result = await client.query(
    `INSERT INTO "specificCategory" (
       "organizationId",
       "sourceCategoryId",
       "sourceCategoryCode",
       name,
       slug,
       "isActive",
       "createdAt",
       "updatedAt"
     )
     VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
     ON CONFLICT DO NOTHING
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
    [
      organizationId,
      safeSourceCategoryId,
      sourceCode || null,
      cleaned,
      slugifySourceCategory(cleaned),
    ]
  );

  return result.rows[0]
    || findSpecificCategoryByName(client, organizationId, {
      name: cleaned,
      sourceCategoryCode: sourceCode,
    });
};

export const formatVariantLabel = (productName, variant) => {
  const parts = [
    productName,
    variant?.variantName,
    variant?.variantNumber,
    variant?.color,
    variant?.size,
  ].filter((part) => cleanInventoryText(String(part || ""), 80));
  return parts.join(" / ");
};
