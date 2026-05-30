ALTER TABLE "CatalogueProduct"
  ADD COLUMN "compareAtPrice" DECIMAL(12, 2),
  ADD COLUMN "publishingStatus" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CatalogueProduct_publishingStatus_updatedAt_idx"
  ON "CatalogueProduct"("publishingStatus", "updatedAt");

CREATE INDEX "CatalogueProduct_isFeatured_idx"
  ON "CatalogueProduct"("isFeatured");
