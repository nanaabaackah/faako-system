ALTER TABLE "CatalogueProduct"
  ALTER COLUMN "stockStatus" SET DEFAULT 'unavailable',
  ADD COLUMN "stockQuantity" INTEGER,
  ADD COLUMN "lowStockThreshold" INTEGER,
  ADD COLUMN "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPurchasable" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CatalogueProduct_stockStatus_idx" ON "CatalogueProduct"("stockStatus");
CREATE INDEX "CatalogueProduct_isPurchasable_idx" ON "CatalogueProduct"("isPurchasable");
