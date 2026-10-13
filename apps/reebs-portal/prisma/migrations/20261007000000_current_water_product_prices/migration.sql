-- Preserve each product's current Water prices before retiring effective-dated
-- price records. Sale rows keep their own price snapshots.
-- The old schedule table forces tenant RLS, so disable it during this
-- administrative backfill; the table is dropped below.
ALTER TABLE "waterProductPrice" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "waterProductPrice" DISABLE ROW LEVEL SECURITY;

CREATE TABLE "waterPriceChange" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "productId" INTEGER,
    "productKey" TEXT NOT NULL,
    "priceType" TEXT NOT NULL,
    "previousPriceCents" INTEGER,
    "newPriceCents" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" INTEGER,
    "changedByName" TEXT,
    "source" TEXT NOT NULL,

    CONSTRAINT "waterPriceChange_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "waterPriceChange_priceType_check"
      CHECK ("priceType" IN ('retail', 'company', 'bulk')),
    CONSTRAINT "waterPriceChange_previousPriceCents_check"
      CHECK ("previousPriceCents" IS NULL OR "previousPriceCents" >= 0),
    CONSTRAINT "waterPriceChange_newPriceCents_check"
      CHECK ("newPriceCents" >= 0)
);

CREATE INDEX "waterPriceChange_org_product_changedAt_idx"
  ON "waterPriceChange" ("organizationId", "productKey", "changedAt" DESC);

CREATE INDEX "waterPriceChange_productId_idx"
  ON "waterPriceChange" ("organizationId", "productId", "changedAt" DESC);

INSERT INTO "waterPriceChange" (
  "organizationId",
  "productId",
  "productKey",
  "priceType",
  "previousPriceCents",
  "newPriceCents",
  "changedAt",
  "changedByUserId",
  "source"
)
SELECT
  history."organizationId",
  history."productId",
  history."productKey",
  CASE history."priceType"
    WHEN 'RETAIL' THEN 'retail'
    WHEN 'COMPANY' THEN 'company'
    WHEN 'BULK_RETAIL' THEN 'bulk'
  END,
  history.previous_price_cents,
  history."priceCents",
  history."createdAt",
  COALESCE(history."updatedByUserId", history."createdByUserId"),
  'legacy-pricing'
FROM (
  SELECT
    price.*,
    LAG(price."priceCents") OVER (
      PARTITION BY price."organizationId", price."productKey", price."priceType"
      ORDER BY price."effectiveFrom", price.id
    ) AS previous_price_cents
  FROM "waterProductPrice" price
  WHERE price."effectiveFrom" <= CURRENT_TIMESTAMP
) history;

ALTER TABLE "waterProductConfig"
  ADD COLUMN "retailPrice" INTEGER,
  ADD COLUMN "bulkPrice" INTEGER;

ALTER TABLE "waterProductConfig"
  ADD CONSTRAINT "waterProductConfig_retailPrice_check"
    CHECK ("retailPrice" IS NULL OR "retailPrice" >= 0),
  ADD CONSTRAINT "waterProductConfig_companyPrice_check"
    CHECK ("companyPrice" IS NULL OR "companyPrice" >= 0),
  ADD CONSTRAINT "waterProductConfig_bulkPrice_check"
    CHECK ("bulkPrice" IS NULL OR "bulkPrice" >= 0);

WITH current_prices AS (
  SELECT DISTINCT ON (price."organizationId", price."productKey", price."priceType")
    price."organizationId",
    price."productKey",
    price."productId",
    price."productName",
    price."priceType",
    price."minimumQuantity",
    price."priceCents"
  FROM "waterProductPrice" price
  WHERE price.active = true
    AND price."effectiveFrom" <= CURRENT_TIMESTAMP
    AND (price."effectiveTo" IS NULL OR price."effectiveTo" > CURRENT_TIMESTAMP)
  ORDER BY price."organizationId", price."productKey", price."priceType",
    price."effectiveFrom" DESC, price.id DESC
),
prices_by_product AS (
  SELECT
    "organizationId",
    "productKey",
    MAX("productId") AS "productId",
    MAX("productName") AS "productName",
    MAX("priceCents") FILTER (WHERE "priceType" = 'RETAIL') AS "retailPrice",
    MAX("priceCents") FILTER (WHERE "priceType" = 'COMPANY') AS "companyPrice",
    MAX("priceCents") FILTER (WHERE "priceType" = 'BULK_RETAIL') AS "bulkPrice",
    MAX("minimumQuantity") FILTER (WHERE "priceType" = 'BULK_RETAIL') AS "bulkThreshold"
  FROM current_prices
  GROUP BY "organizationId", "productKey"
)
INSERT INTO "waterProductConfig" (
  "organizationId",
  "productKey",
  "productName",
  "inventoryProductId",
  "retailPrice",
  "companyPrice",
  "bulkPrice",
  "bulkThreshold",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  prices."organizationId",
  prices."productKey",
  prices."productName",
  prices."productId",
  prices."retailPrice",
  prices."companyPrice",
  prices."bulkPrice",
  COALESCE(prices."bulkThreshold", 10),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM prices_by_product prices
ON CONFLICT ("organizationId", "productKey") DO UPDATE
SET "productName" = EXCLUDED."productName",
    "inventoryProductId" = COALESCE(EXCLUDED."inventoryProductId", "waterProductConfig"."inventoryProductId"),
    "retailPrice" = COALESCE(EXCLUDED."retailPrice", "waterProductConfig"."retailSinglePrice"),
    "companyPrice" = COALESCE(EXCLUDED."companyPrice", "waterProductConfig"."companyPrice"),
    "bulkPrice" = COALESCE(EXCLUDED."bulkPrice", "waterProductConfig"."retailBulkPrice"),
    "bulkThreshold" = COALESCE(EXCLUDED."bulkThreshold", "waterProductConfig"."bulkThreshold"),
    "updatedAt" = CURRENT_TIMESTAMP;

-- Preserve existing standalone configuration values for products with no
-- currently effective schedule, without allowing scheduled data to remain live.
UPDATE "waterProductConfig"
SET "retailPrice" = COALESCE("retailPrice", "retailSinglePrice"),
    "bulkPrice" = COALESCE("bulkPrice", "retailBulkPrice");

ALTER TABLE "waterProductConfig"
  DROP COLUMN "retailSinglePrice",
  DROP COLUMN "retailBulkPrice";

DROP INDEX IF EXISTS "waterSale_organizationId_waterProductPriceId_idx";
ALTER TABLE "waterSale"
  DROP CONSTRAINT IF EXISTS "waterSale_waterProductPriceId_fkey",
  DROP COLUMN IF EXISTS "waterProductPriceId";

DROP TABLE "waterProductPrice";

ALTER TABLE "waterPriceChange"
  ADD CONSTRAINT "waterPriceChange_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "waterPriceChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterPriceChange" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "waterPriceChange"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);
