-- Additive catalogue tier and proposal snapshot support. This migration does
-- not rewrite existing proposals, quotations, catalogue prices, or invoices.
CREATE TYPE "CommercialTierPriceModel" AS ENUM ('FIXED', 'PERCENTAGE', 'USAGE', 'CUSTOM_QUOTE');

ALTER TABLE "CommercialCatalogueItem"
  ADD COLUMN "systemKey" TEXT,
  ADD COLUMN "sourceUrl" TEXT;

ALTER TABLE "ProposalVersionItem"
  ADD COLUMN "selectedTierName" TEXT,
  ADD COLUMN "pricingSourceUrl" TEXT,
  ADD COLUMN "pricingVerifiedAt" DATE,
  ADD COLUMN "providerCharge" JSONB;

CREATE TABLE "CommercialCatalogueTier" (
  "id" SERIAL NOT NULL,
  "catalogueItemId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "priceModel" "CommercialTierPriceModel" NOT NULL DEFAULT 'FIXED',
  "providerAmount" DECIMAL(14,2),
  "providerCurrency" TEXT,
  "displayPrice" TEXT,
  "faakoSetupFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "billingFrequency" "CommercialBillingFrequency" NOT NULL DEFAULT 'NONE',
  "sourceUrl" TEXT,
  "lastVerifiedAt" DATE,
  "includedFeatures" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialCatalogueTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialCatalogueItem_organizationId_systemKey_key"
  ON "CommercialCatalogueItem"("organizationId", "systemKey");
CREATE UNIQUE INDEX "CommercialCatalogueTier_catalogueItemId_normalizedName_key"
  ON "CommercialCatalogueTier"("catalogueItemId", "normalizedName");
CREATE INDEX "CommercialCatalogueTier_catalogueItemId_active_sortOrder_idx"
  ON "CommercialCatalogueTier"("catalogueItemId", "active", "sortOrder");

ALTER TABLE "CommercialCatalogueTier"
  ADD CONSTRAINT "CommercialCatalogueTier_catalogueItemId_fkey"
  FOREIGN KEY ("catalogueItemId") REFERENCES "CommercialCatalogueItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
