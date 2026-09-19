-- Inventory integrity foundation.
-- This migration is intentionally additive. Deploy it before code that writes
-- idempotent stock movements; do not apply it to production automatically.

ALTER TABLE "stockMovement"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "previousStock" INTEGER,
  ADD COLUMN IF NOT EXISTS "resultingStock" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "stockMovement_organizationId_idempotencyKey_key"
  ON "stockMovement" ("organizationId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "stockMovement_organizationId_productId_date_idx"
  ON "stockMovement" ("organizationId", "productId", "date" DESC);

CREATE INDEX IF NOT EXISTS "stockMovement_organizationId_sourceType_sourceId_idx"
  ON "stockMovement" ("organizationId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "maintenanceLog_organizationId_status_idx"
  ON "maintenanceLog" ("organizationId", status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_stock_nonnegative_check'
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_stock_nonnegative_check" CHECK (stock >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventoryVariant_stockQty_nonnegative_check'
  ) THEN
    ALTER TABLE "inventoryVariant"
      ADD CONSTRAINT "inventoryVariant_stockQty_nonnegative_check" CHECK ("stockQty" >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventoryVariant_reservedQty_nonnegative_check'
  ) THEN
    ALTER TABLE "inventoryVariant"
      ADD CONSTRAINT "inventoryVariant_reservedQty_nonnegative_check" CHECK ("reservedQty" >= 0) NOT VALID;
  END IF;
END $$;
