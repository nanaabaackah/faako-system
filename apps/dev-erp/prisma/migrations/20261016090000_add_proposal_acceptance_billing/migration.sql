-- Phase 4 formal acceptance, billing schedules, and invoice traceability.
-- Additive only. Existing proposals, quotations, invoices, and payments are not rewritten.

ALTER TYPE "ProposalVersionStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "ProposalVersionStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "ProposalVersionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "ProposalBillingScheduleStatus" AS ENUM (
  'PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ERROR'
);

CREATE TYPE "ProposalBillingGenerationRule" AS ENUM (
  'ON_ACCEPTANCE', 'MANUAL', 'SCHEDULED'
);

ALTER TABLE "ProposalApprovalSnapshot"
  ADD COLUMN "accessLinkId" INTEGER,
  ADD COLUMN "acceptanceKey" TEXT,
  ADD COLUMN "scopeSnapshot" JSONB,
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "consentConfirmed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProposalBillingScheduleItem"
  ADD COLUMN "status" "ProposalBillingScheduleStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "generationRule" "ProposalBillingGenerationRule" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "startDate" DATE,
  ADD COLUMN "nextBillingDate" DATE,
  ADD COLUMN "lastBillingDate" DATE,
  ADD COLUMN "generatedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxOccurrences" INTEGER;

ALTER TABLE "Invoice"
  ADD COLUMN "proposalVersionId" INTEGER,
  ADD COLUMN "billingScheduleItemId" INTEGER,
  ADD COLUMN "generationKey" TEXT;

ALTER TABLE "Project"
  ADD COLUMN "acceptedProposalVersionId" INTEGER;

CREATE UNIQUE INDEX "ProposalApprovalSnapshot_acceptanceKey_key"
  ON "ProposalApprovalSnapshot"("acceptanceKey");
CREATE INDEX "ProposalApprovalSnapshot_accessLinkId_status_idx"
  ON "ProposalApprovalSnapshot"("accessLinkId", "status");
CREATE INDEX "ProposalBillingScheduleItem_status_nextBillingDate_idx"
  ON "ProposalBillingScheduleItem"("status", "nextBillingDate");
CREATE UNIQUE INDEX "Invoice_generationKey_key" ON "Invoice"("generationKey");
CREATE UNIQUE INDEX "Project_acceptedProposalVersionId_key"
  ON "Project"("acceptedProposalVersionId");
CREATE INDEX "Invoice_proposalVersionId_status_idx"
  ON "Invoice"("proposalVersionId", "status");
CREATE INDEX "Invoice_billingScheduleItemId_issueDate_idx"
  ON "Invoice"("billingScheduleItemId", "issueDate");

ALTER TABLE "ProposalApprovalSnapshot"
  ADD CONSTRAINT "ProposalApprovalSnapshot_accessLinkId_fkey"
  FOREIGN KEY ("accessLinkId") REFERENCES "ProposalAccessLink"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_proposalVersionId_fkey"
  FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Invoice_billingScheduleItemId_fkey"
  FOREIGN KEY ("billingScheduleItemId") REFERENCES "ProposalBillingScheduleItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_acceptedProposalVersionId_fkey"
  FOREIGN KEY ("acceptedProposalVersionId") REFERENCES "ProposalVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
