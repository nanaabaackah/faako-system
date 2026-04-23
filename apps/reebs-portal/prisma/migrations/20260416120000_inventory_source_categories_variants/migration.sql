-- Add dynamic inventory products and variant stock units without removing legacy fields.

CREATE TABLE IF NOT EXISTS "sourceCategory" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sourceCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sourceCategory_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sourceCategory_organizationId_isActive_idx"
  ON "sourceCategory" ("organizationId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "sourceCategory_org_name_ci_key"
  ON "sourceCategory" ("organizationId", lower("name"));

CREATE UNIQUE INDEX IF NOT EXISTS "sourceCategory_org_slug_ci_key"
  ON "sourceCategory" ("organizationId", lower("slug"));

CREATE TABLE IF NOT EXISTS "specificCategory" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL DEFAULT 1,
  "sourceCategoryId" INTEGER,
  "sourceCategoryCode" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "specificCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "specificCategory_sourceCategoryId_fkey"
    FOREIGN KEY ("sourceCategoryId") REFERENCES "sourceCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "specificCategory_organization_source_idx"
  ON "specificCategory" ("organizationId", "sourceCategoryCode", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "specificCategory_org_source_name_ci_key"
  ON "specificCategory" ("organizationId", COALESCE("sourceCategoryCode", ''), lower("name"));

UPDATE "sourceCategory" sc
SET "name" = 'Rentals',
    "slug" = 'rentals',
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(sc."name") = 'rental'
  AND NOT EXISTS (
    SELECT 1
    FROM "sourceCategory" existing
    WHERE existing."organizationId" = sc."organizationId"
      AND lower(existing."name") = 'rentals'
  );

UPDATE "sourceCategory" legacy
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(legacy."name") = 'rental'
  AND EXISTS (
    SELECT 1
    FROM "sourceCategory" canonical
    WHERE canonical."organizationId" = legacy."organizationId"
      AND lower(canonical."name") = 'rentals'
  );

INSERT INTO "sourceCategory" ("organizationId", "name", "slug", "isActive", "createdAt", "updatedAt")
SELECT o.id, defaults.name, defaults.slug, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organization" o
CROSS JOIN (
  VALUES
    ('Toys', 'toys'),
    ('Rentals', 'rentals'),
    ('Clothes', 'clothes'),
    ('Shoes', 'shoes'),
    ('Supplies', 'supplies'),
    ('Household', 'household')
) AS defaults(name, slug)
WHERE NOT EXISTS (
  SELECT 1
  FROM "sourceCategory" existing
  WHERE existing."organizationId" = o.id
    AND lower(existing.name) = lower(defaults.name)
);

ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "sourceCategoryId" INTEGER,
  ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "reorderQuantity" INTEGER NOT NULL DEFAULT 0;

-- Re-point products that were linked to the old 'rental' category to the canonical 'rentals' one.
UPDATE "product" p
SET "sourceCategoryId" = canonical.id,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "sourceCategory" legacy
JOIN "sourceCategory" canonical
  ON canonical."organizationId" = legacy."organizationId"
 AND lower(canonical."name") = 'rentals'
WHERE p."sourceCategoryId" = legacy.id
  AND p."organizationId" = legacy."organizationId"
  AND lower(legacy."name") = 'rental';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_sourceCategoryId_fkey'
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_sourceCategoryId_fkey"
      FOREIGN KEY ("sourceCategoryId") REFERENCES "sourceCategory"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "product_sourceCategoryId_idx"
  ON "product" ("sourceCategoryId");

CREATE INDEX IF NOT EXISTS "product_organizationId_itemType_idx"
  ON "product" ("organizationId", "itemType");

UPDATE "product" p
SET "sourceCategoryId" = sc.id,
    "specificCategory" = COALESCE(NULLIF(p."specificCategory", ''), sc.name),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "sourceCategory" sc
WHERE sc."organizationId" = p."organizationId"
  AND lower(sc.name) = 'toys'
  AND p."sourceCategoryId" IS NULL
  AND upper(COALESCE(p."sourceCategoryCode", '')) = 'TOYS';

CREATE TABLE IF NOT EXISTS "inventoryVariant" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL DEFAULT 1,
  "inventoryItemId" INTEGER NOT NULL,
  "sku" TEXT NOT NULL,
  "variantNumber" TEXT,
  "color" TEXT,
  "size" TEXT,
  "stockQty" INTEGER NOT NULL DEFAULT 0,
  "reservedQty" INTEGER NOT NULL DEFAULT 0,
  "reorderLevel" INTEGER NOT NULL DEFAULT 2,
  "priceOverride" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventoryVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventoryVariant_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventoryVariant_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventoryVariant_organizationId_sku_key"
  ON "inventoryVariant" ("organizationId", "sku");

CREATE UNIQUE INDEX IF NOT EXISTS "inventoryVariant_org_item_dimensions_key"
  ON "inventoryVariant" (
    "organizationId",
    "inventoryItemId",
    COALESCE("variantNumber", ''),
    COALESCE("color", ''),
    COALESCE("size", '')
  );

CREATE INDEX IF NOT EXISTS "inventoryVariant_organizationId_inventoryItemId_idx"
  ON "inventoryVariant" ("organizationId", "inventoryItemId");

ALTER TABLE "orderItem"
  ADD COLUMN IF NOT EXISTS "variantId" INTEGER;

ALTER TABLE "bookingItem"
  ADD COLUMN IF NOT EXISTS "variantId" INTEGER;

ALTER TABLE "stockMovement"
  ADD COLUMN IF NOT EXISTS "variantId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orderItem_variantId_fkey'
  ) THEN
    ALTER TABLE "orderItem"
      ADD CONSTRAINT "orderItem_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "inventoryVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookingItem_variantId_fkey'
  ) THEN
    ALTER TABLE "bookingItem"
      ADD CONSTRAINT "bookingItem_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "inventoryVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stockMovement_variantId_fkey'
  ) THEN
    ALTER TABLE "stockMovement"
      ADD CONSTRAINT "stockMovement_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "inventoryVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "orderItem_variantId_idx"
  ON "orderItem" ("variantId");

CREATE INDEX IF NOT EXISTS "bookingItem_variantId_idx"
  ON "bookingItem" ("variantId");

CREATE INDEX IF NOT EXISTS "stockMovement_variantId_idx"
  ON "stockMovement" ("variantId");
