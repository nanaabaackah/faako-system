-- Structured proposal foundation.
-- Additive only: existing proposals, invoice quotations, invoices, and payments are not rewritten.

CREATE TYPE "CommercialItemKind" AS ENUM ('SERVICE', 'INTEGRATION');
CREATE TYPE "CommercialBillingType" AS ENUM ('ONE_TIME', 'RECURRING', 'USAGE_BASED', 'INCLUDED');
CREATE TYPE "CommercialBillingFrequency" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');
CREATE TYPE "CommercialCostOwnership" AS ENUM ('FAAKO_BILLED', 'CLIENT_DIRECT', 'INCLUDED', 'PASS_THROUGH');
CREATE TYPE "ProposalVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'WITHDRAWN');
CREATE TYPE "ProposalRevisionStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');
CREATE TYPE "ProposalApprovalStatus" AS ENUM ('PREPARED', 'ACCEPTED', 'REVOKED');
CREATE TYPE "ProposalBillingScheduleType" AS ENUM ('FULL', 'DEPOSIT', 'MILESTONE', 'BALANCE', 'RECURRING');

ALTER TABLE "Proposal" ADD COLUMN "projectId" INTEGER;

CREATE TABLE "CommercialCatalogueItem" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "kind" "CommercialItemKind" NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "deliverables" JSONB,
  "defaultUnitPrice" DECIMAL(14,2),
  "defaultBillingType" "CommercialBillingType" NOT NULL DEFAULT 'ONE_TIME',
  "defaultBillingFrequency" "CommercialBillingFrequency" NOT NULL DEFAULT 'NONE',
  "defaultCostOwnership" "CommercialCostOwnership" NOT NULL DEFAULT 'FAAKO_BILLED',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialCatalogueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialCatalogueDependency" (
  "id" SERIAL NOT NULL,
  "itemId" INTEGER NOT NULL,
  "dependsOnItemId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialCatalogueDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialPackage" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialPackageItem" (
  "id" SERIAL NOT NULL,
  "packageId" INTEGER NOT NULL,
  "catalogueItemId" INTEGER,
  "configuration" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialPackageItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalVersion" (
  "id" SERIAL NOT NULL,
  "proposalId" INTEGER NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "ProposalVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "schemaVersion" INTEGER NOT NULL DEFAULT 2,
  "customerReference" TEXT,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerAddress" TEXT,
  "projectReference" TEXT,
  "projectTitle" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "currency" "CurrencyCode" NOT NULL,
  "validUntil" DATE,
  "scope" TEXT,
  "exclusions" JSONB,
  "terms" JSONB,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "depositPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "oneTimeTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "recurringMonthlyTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "recurringAnnualTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "depositAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "sourceSnapshot" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalVersionItem" (
  "id" SERIAL NOT NULL,
  "proposalVersionId" INTEGER NOT NULL,
  "catalogueItemId" INTEGER,
  "kind" "CommercialItemKind" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "deliverables" JSONB,
  "quantity" DECIMAL(10,2) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amount" DECIMAL(14,2) NOT NULL,
  "billingType" "CommercialBillingType" NOT NULL,
  "billingFrequency" "CommercialBillingFrequency" NOT NULL DEFAULT 'NONE',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "clientSelectable" BOOLEAN NOT NULL DEFAULT false,
  "selectedByDefault" BOOLEAN NOT NULL DEFAULT true,
  "custom" BOOLEAN NOT NULL DEFAULT false,
  "costOwnership" "CommercialCostOwnership" NOT NULL DEFAULT 'FAAKO_BILLED',
  "estimatedDelivery" TEXT,
  "internalNotes" TEXT,
  "clientNotes" TEXT,
  "dependencies" JSONB,
  "configuration" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalVersionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalClientSelection" (
  "id" SERIAL NOT NULL,
  "proposalVersionId" INTEGER NOT NULL,
  "proposalVersionItemId" INTEGER NOT NULL,
  "clientKey" TEXT NOT NULL DEFAULT 'default',
  "selected" BOOLEAN NOT NULL,
  "quantity" DECIMAL(10,2),
  "configuration" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalClientSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalRevisionRequest" (
  "id" SERIAL NOT NULL,
  "proposalId" INTEGER NOT NULL,
  "proposalVersionId" INTEGER NOT NULL,
  "status" "ProposalRevisionStatus" NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "requesterName" TEXT,
  "requesterContact" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalRevisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalApprovalSnapshot" (
  "id" SERIAL NOT NULL,
  "proposalVersionId" INTEGER NOT NULL,
  "status" "ProposalApprovalStatus" NOT NULL DEFAULT 'PREPARED',
  "selectionSnapshot" JSONB NOT NULL,
  "pricingSnapshot" JSONB NOT NULL,
  "termsSnapshot" JSONB,
  "approverName" TEXT,
  "approverContact" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalApprovalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalBillingScheduleItem" (
  "id" SERIAL NOT NULL,
  "proposalVersionId" INTEGER NOT NULL,
  "type" "ProposalBillingScheduleType" NOT NULL,
  "label" TEXT NOT NULL,
  "percentage" DECIMAL(5,2),
  "amount" DECIMAL(14,2) NOT NULL,
  "dueRule" TEXT,
  "billingFrequency" "CommercialBillingFrequency" NOT NULL DEFAULT 'NONE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalBillingScheduleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalAccessLink" (
  "id" SERIAL NOT NULL,
  "proposalVersionId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalAccessLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialCatalogueItem_organizationId_kind_normalizedName_key"
  ON "CommercialCatalogueItem"("organizationId", "kind", "normalizedName");
CREATE INDEX "CommercialCatalogueItem_organizationId_kind_active_idx"
  ON "CommercialCatalogueItem"("organizationId", "kind", "active");
CREATE INDEX "CommercialCatalogueItem_organizationId_category_idx"
  ON "CommercialCatalogueItem"("organizationId", "category");
CREATE UNIQUE INDEX "CommercialCatalogueDependency_itemId_dependsOnItemId_key"
  ON "CommercialCatalogueDependency"("itemId", "dependsOnItemId");
CREATE INDEX "CommercialCatalogueDependency_dependsOnItemId_idx"
  ON "CommercialCatalogueDependency"("dependsOnItemId");
CREATE UNIQUE INDEX "CommercialPackage_organizationId_normalizedName_key"
  ON "CommercialPackage"("organizationId", "normalizedName");
CREATE INDEX "CommercialPackage_organizationId_active_idx"
  ON "CommercialPackage"("organizationId", "active");
CREATE INDEX "CommercialPackageItem_packageId_sortOrder_idx"
  ON "CommercialPackageItem"("packageId", "sortOrder");
CREATE INDEX "CommercialPackageItem_catalogueItemId_idx"
  ON "CommercialPackageItem"("catalogueItemId");
CREATE UNIQUE INDEX "ProposalVersion_proposalId_versionNumber_key"
  ON "ProposalVersion"("proposalId", "versionNumber");
CREATE INDEX "ProposalVersion_proposalId_status_idx"
  ON "ProposalVersion"("proposalId", "status");
CREATE INDEX "ProposalVersionItem_proposalVersionId_sortOrder_idx"
  ON "ProposalVersionItem"("proposalVersionId", "sortOrder");
CREATE INDEX "ProposalVersionItem_catalogueItemId_idx"
  ON "ProposalVersionItem"("catalogueItemId");
CREATE UNIQUE INDEX "ProposalClientSelection_proposalVersionItemId_clientKey_key"
  ON "ProposalClientSelection"("proposalVersionItemId", "clientKey");
CREATE INDEX "ProposalClientSelection_proposalVersionId_clientKey_idx"
  ON "ProposalClientSelection"("proposalVersionId", "clientKey");
CREATE INDEX "ProposalRevisionRequest_proposalId_status_idx"
  ON "ProposalRevisionRequest"("proposalId", "status");
CREATE INDEX "ProposalRevisionRequest_proposalVersionId_createdAt_idx"
  ON "ProposalRevisionRequest"("proposalVersionId", "createdAt");
CREATE UNIQUE INDEX "ProposalApprovalSnapshot_proposalVersionId_key"
  ON "ProposalApprovalSnapshot"("proposalVersionId");
CREATE INDEX "ProposalBillingScheduleItem_proposalVersionId_sortOrder_idx"
  ON "ProposalBillingScheduleItem"("proposalVersionId", "sortOrder");
CREATE UNIQUE INDEX "ProposalAccessLink_tokenHash_key" ON "ProposalAccessLink"("tokenHash");
CREATE INDEX "ProposalAccessLink_proposalVersionId_revokedAt_idx"
  ON "ProposalAccessLink"("proposalVersionId", "revokedAt");
CREATE INDEX "ProposalAccessLink_expiresAt_idx" ON "ProposalAccessLink"("expiresAt");
CREATE INDEX "Proposal_organizationId_projectId_idx" ON "Proposal"("organizationId", "projectId");

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommercialCatalogueItem" ADD CONSTRAINT "CommercialCatalogueItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCatalogueDependency" ADD CONSTRAINT "CommercialCatalogueDependency_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "CommercialCatalogueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialCatalogueDependency" ADD CONSTRAINT "CommercialCatalogueDependency_dependsOnItemId_fkey"
  FOREIGN KEY ("dependsOnItemId") REFERENCES "CommercialCatalogueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialPackage" ADD CONSTRAINT "CommercialPackage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialPackageItem" ADD CONSTRAINT "CommercialPackageItem_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "CommercialPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialPackageItem" ADD CONSTRAINT "CommercialPackageItem_catalogueItemId_fkey"
  FOREIGN KEY ("catalogueItemId") REFERENCES "CommercialCatalogueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalVersionItem" ADD CONSTRAINT "ProposalVersionItem_proposalVersionId_fkey"
  FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalVersionItem" ADD CONSTRAINT "ProposalVersionItem_catalogueItemId_fkey"
  FOREIGN KEY ("catalogueItemId") REFERENCES "CommercialCatalogueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalClientSelection" ADD CONSTRAINT "ProposalClientSelection_proposalVersionId_fkey"
  FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalClientSelection" ADD CONSTRAINT "ProposalClientSelection_proposalVersionItemId_fkey"
  FOREIGN KEY ("proposalVersionItemId") REFERENCES "ProposalVersionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalRevisionRequest" ADD CONSTRAINT "ProposalRevisionRequest_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalRevisionRequest" ADD CONSTRAINT "ProposalRevisionRequest_proposalVersionId_fkey"
  FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalApprovalSnapshot" ADD CONSTRAINT "ProposalApprovalSnapshot_proposalVersionId_fkey"
  FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalBillingScheduleItem" ADD CONSTRAINT "ProposalBillingScheduleItem_proposalVersionId_fkey"
  FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalAccessLink" ADD CONSTRAINT "ProposalAccessLink_proposalVersionId_fkey"
  FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
