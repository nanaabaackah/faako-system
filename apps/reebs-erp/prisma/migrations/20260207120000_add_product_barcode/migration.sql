ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "product_barcode_org_unique"
  ON "product" ("organizationId", "barcode");
