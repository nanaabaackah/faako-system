-- Water remains a standalone business domain. This table stores the current
-- Water commercial configuration; transaction tables retain their own snapshots.
CREATE TABLE IF NOT EXISTS "waterProductConfig" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "inventoryProductId" INTEGER,
    "retailSinglePrice" INTEGER,
    "retailBulkPrice" INTEGER,
    "companyPrice" INTEGER,
    "bulkThreshold" INTEGER NOT NULL DEFAULT 10,
    "costPrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waterProductConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "waterProductConfig_organizationId_productKey_key"
ON "waterProductConfig"("organizationId", "productKey");

CREATE INDEX IF NOT EXISTS "waterProductConfig_organizationId_isActive_idx"
ON "waterProductConfig"("organizationId", "isActive");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'waterProductConfig_organizationId_fkey'
          AND conrelid = '"waterProductConfig"'::regclass
    ) THEN
        ALTER TABLE "waterProductConfig"
        ADD CONSTRAINT "waterProductConfig_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Phase 6 already introduced priceOverrideReason. IF NOT EXISTS also makes this
-- migration safe to retry after PostgreSQL retained earlier successful DDL from
-- a failed production attempt.
ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "baseUnitPrice" INTEGER;
ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "unitCostAtTransaction" INTEGER;
ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "priceOverrideReason" TEXT;
ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "priceOverrideActorId" INTEGER;
ALTER TABLE "waterRestock" ALTER COLUMN "unitCost" DROP DEFAULT;
ALTER TABLE "waterRestock" ALTER COLUMN "productKey" SET DEFAULT 'gwater-15pk';
ALTER TABLE "waterRestock" ALTER COLUMN "productName" SET DEFAULT '15pk Gwater';
ALTER TABLE "waterSale" ALTER COLUMN "productKey" SET DEFAULT 'gwater-15pk';
ALTER TABLE "waterSale" ALTER COLUMN "productName" SET DEFAULT '15pk Gwater';
ALTER TABLE "waterAdjustment" ALTER COLUMN "productKey" SET DEFAULT 'gwater-15pk';
ALTER TABLE "waterAdjustment" ALTER COLUMN "productName" SET DEFAULT '15pk Gwater';

-- Preserve the established Water rates for existing organisations while moving
-- authority out of application code. Prefer the linked inventory product's
-- current selling/cost values where they are already configured.
INSERT INTO "waterProductConfig" (
    "organizationId",
    "productKey",
    "productName",
    "inventoryProductId",
    "retailSinglePrice",
    "retailBulkPrice",
    "companyPrice",
    "bulkThreshold",
    "costPrice",
    "createdAt",
    "updatedAt"
)
SELECT
    organization.id,
    'gwater-15pk',
    COALESCE(water_product.name, '15pk Gwater'),
    water_product.id,
    CASE WHEN water_product.price > 0 THEN water_product.price ELSE 2700 END,
    2600,
    2500,
    10,
    CASE
      WHEN water_product."purchasePriceGhs" > 0 THEN water_product."purchasePriceGhs"
      ELSE 2200
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organization" organization
LEFT JOIN LATERAL (
    SELECT product.id, product.name, product.price, product."purchasePriceGhs"
    FROM "product" product
    WHERE product."organizationId" = organization.id
      AND COALESCE(product."isDeleted", false) = false
      AND COALESCE(product."isArchived", false) = false
      AND LOWER(COALESCE(product.name, '')) LIKE '%water%'
    ORDER BY
      CASE WHEN LOWER(COALESCE(product.name, '')) LIKE '%gwater%' THEN 0 ELSE 1 END,
      product.id
    LIMIT 1
) water_product ON true
ON CONFLICT ("organizationId", "productKey") DO NOTHING;

-- Existing sales have no trustworthy historical cost context. Leave the new
-- cost snapshot NULL so profitability is reported as unavailable, not fabricated.
UPDATE "waterSale"
SET "baseUnitPrice" = "unitPrice"
WHERE "baseUnitPrice" IS NULL;
