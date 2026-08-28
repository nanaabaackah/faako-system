-- Phase 6 commercial configuration foundation.
--
-- This migration is additive and intentionally seeds the values that were live
-- in application code immediately before Phase 6. Review and deploy it in each
-- environment before deploying handlers that resolve these records. It does not
-- recalculate or update any historical order, booking, invoice, or Water sale.

-- New order lines can snapshot their authoritative cost without inventing a
-- cost for legacy lines. Existing rows intentionally remain NULL and must be
-- classified by separate reconciliation tooling.
ALTER TABLE "orderItem"
  ADD COLUMN "unitCostCents" INTEGER;

-- Align canonical Water defaults with the live 15-pack product without
-- rewriting any historical row. New restocks must always provide an explicit
-- recorded cost; there is no database-level business-value fallback.
ALTER TABLE "waterRestock"
  ALTER COLUMN "productKey" SET DEFAULT 'gwater-15pk',
  ALTER COLUMN "productName" SET DEFAULT '15pk Gwater',
  ALTER COLUMN "unitCost" DROP DEFAULT;

ALTER TABLE "waterSale"
  ALTER COLUMN "productKey" SET DEFAULT 'gwater-15pk',
  ALTER COLUMN "productName" SET DEFAULT '15pk Gwater',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "archivedByName" TEXT;

ALTER TABLE "waterExpense"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "archivedByName" TEXT;

ALTER TABLE "waterAdjustment"
  ALTER COLUMN "productKey" SET DEFAULT 'gwater-15pk',
  ALTER COLUMN "productName" SET DEFAULT '15pk Gwater';

CREATE TABLE "commercialConfiguration" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "businessUnit" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercialConfiguration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercialConfiguration_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "commercialConfiguration_businessUnit_check"
      CHECK ("businessUnit" IN ('REEBS_CORE', 'WATER', 'SHARED')),
    CONSTRAINT "commercialConfiguration_valueType_check"
      CHECK ("valueType" IN ('INTEGER', 'MONEY_CENTS', 'BASIS_POINTS', 'BOOLEAN', 'STRING')),
    CONSTRAINT "commercialConfiguration_effective_window_check"
      CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE UNIQUE INDEX "commercialConfiguration_org_unit_key_from_key"
  ON "commercialConfiguration" ("organizationId", "businessUnit", "key", "effectiveFrom");

CREATE INDEX "commercialConfiguration_current_lookup_idx"
  ON "commercialConfiguration" (
    "organizationId",
    "businessUnit",
    "key",
    "active",
    "effectiveFrom",
    "effectiveTo"
  );

CREATE TABLE "waterProductPrice" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "productId" INTEGER,
    "productKey" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "priceType" TEXT NOT NULL,
    "minimumQuantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waterProductPrice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "waterProductPrice_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waterProductPrice_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "waterProductPrice_type_check"
      CHECK ("priceType" IN ('RETAIL', 'BULK_RETAIL', 'COMPANY')),
    CONSTRAINT "waterProductPrice_minimum_quantity_check"
      CHECK ("minimumQuantity" > 0),
    CONSTRAINT "waterProductPrice_price_cents_check"
      CHECK ("priceCents" > 0),
    CONSTRAINT "waterProductPrice_currency_check"
      CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "waterProductPrice_effective_window_check"
      CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE UNIQUE INDEX "waterProductPrice_org_product_type_from_key"
  ON "waterProductPrice" ("organizationId", "productKey", "priceType", "effectiveFrom");

CREATE INDEX "waterProductPrice_current_lookup_idx"
  ON "waterProductPrice" (
    "organizationId",
    "productKey",
    "priceType",
    "active",
    "effectiveFrom",
    "effectiveTo"
  );

CREATE INDEX "waterProductPrice_organizationId_productId_idx"
  ON "waterProductPrice" ("organizationId", "productId");

-- New Water sales can retain both the effective standard price and any explicit
-- authorized override. Legacy sales keep their existing unitPrice snapshot and
-- remain NULL here until separately classified; no historical amount is changed.
ALTER TABLE "waterSale"
  ADD COLUMN "unitCostAtSaleCents" INTEGER,
  ADD COLUMN "standardUnitPrice" INTEGER,
  ADD COLUMN "waterProductPriceId" INTEGER,
  ADD COLUMN "priceOverrideReason" TEXT,
  ADD COLUMN "priceOverriddenByUserId" INTEGER,
  ADD COLUMN "priceOverriddenAt" TIMESTAMP(3),
  ADD CONSTRAINT "waterSale_waterProductPriceId_fkey"
    FOREIGN KEY ("waterProductPriceId") REFERENCES "waterProductPrice"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "waterSale_organizationId_waterProductPriceId_idx"
  ON "waterSale" ("organizationId", "waterProductPriceId");

-- Preserve the pre-Phase-6 Core rules for every existing organization. Values
-- are stored in their calculation units: integer counts/days, pesewas, or bps.
INSERT INTO "commercialConfiguration" (
  "organizationId",
  "businessUnit",
  "key",
  "value",
  "valueType",
  "effectiveFrom",
  "active",
  "description",
  "createdAt",
  "updatedAt"
)
SELECT
  organization.id,
  seed."businessUnit",
  seed."key",
  seed."value",
  seed."valueType",
  CURRENT_TIMESTAMP,
  true,
  seed.description,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organization" AS organization
CROSS JOIN (
  VALUES
    ('REEBS_CORE', 'booking_bundle_min_items', '3', 'INTEGER', 'Preserves the live three-item bundle threshold.'),
    ('REEBS_CORE', 'booking_bundle_discount_bps', '1000', 'BASIS_POINTS', 'Preserves the live 10 percent bundle discount.'),
    ('REEBS_CORE', 'booking_attendant_unit_fee_cents', '10000', 'MONEY_CENTS', 'Preserves the live GHS 100 attendant fee.'),
    ('REEBS_CORE', 'delivery_per_km_fee_cents', '50', 'MONEY_CENTS', 'Preserves the live GHS 0.50 per-kilometre delivery rate.'),
    ('REEBS_CORE', 'service_deposit_bps', '7000', 'BASIS_POINTS', 'Preserves the live 70 percent service deposit rule.'),
    ('REEBS_CORE', 'service_deposit_due_days', '2', 'INTEGER', 'Preserves the live 48-hour service deposit deadline.'),
    ('WATER', 'water_discount_limit_bps', '9999', 'BASIS_POINTS', 'Compatibility ceiling preserving the existing less-than-100-percent validation; not a new discount policy.')
) AS seed("businessUnit", "key", "value", "valueType", description)
WHERE NOT EXISTS (
  SELECT 1
  FROM "commercialConfiguration" AS existing
  WHERE existing."organizationId" = organization.id
    AND existing."businessUnit" = seed."businessUnit"
    AND existing."key" = seed."key"
    AND existing."active" = true
);

-- Seed product-specific Water price history without guessing an inventory link.
-- productId remains NULL until a deterministic classifier/manual review links
-- the canonical Water product. These values preserve the live module constants.
INSERT INTO "waterProductPrice" (
  "organizationId",
  "productId",
  "productKey",
  "productName",
  "priceType",
  "minimumQuantity",
  "priceCents",
  "currency",
  "effectiveFrom",
  "active",
  "description",
  "createdAt",
  "updatedAt"
)
SELECT
  organization.id,
  NULL,
  'gwater-15pk',
  '15pk Gwater',
  seed."priceType",
  seed."minimumQuantity",
  seed."priceCents",
  'GHS',
  CURRENT_TIMESTAMP,
  true,
  seed.description,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organization" AS organization
CROSS JOIN (
  VALUES
    ('RETAIL', 1, 2700, 'Single-pack retail price.'),
    ('BULK_RETAIL', 10, 2600, 'Retail price from ten packs, preserving the live threshold.'),
    ('COMPANY', 1, 2500, 'Company-channel price.')
) AS seed("priceType", "minimumQuantity", "priceCents", description)
WHERE NOT EXISTS (
  SELECT 1
  FROM "waterProductPrice" AS existing
  WHERE existing."organizationId" = organization.id
    AND existing."productKey" = 'gwater-15pk'
    AND existing."priceType" = seed."priceType"
    AND existing."active" = true
);

-- Tenant context is authoritative for the new organization-scoped tables.
ALTER TABLE "commercialConfiguration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercialConfiguration" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "commercialConfiguration"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);

ALTER TABLE "waterProductPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterProductPrice" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "waterProductPrice"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);
