ALTER TYPE "SignupStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE "SignupStatus" ADD VALUE IF NOT EXISTS 'PROPOSAL_SENT';
ALTER TYPE "SignupStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "SignupStatus" ADD VALUE IF NOT EXISTS 'SETUP_IN_PROGRESS';
ALTER TYPE "SignupStatus" ADD VALUE IF NOT EXISTS 'CONVERTED';

ALTER TABLE "SignupRequest"
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedOwner" TEXT,
  ADD COLUMN IF NOT EXISTS "activityTimeline" JSONB,
  ADD COLUMN IF NOT EXISTS "emailDelivery" JSONB,
  ADD COLUMN IF NOT EXISTS "pdfSummary" JSONB,
  ADD COLUMN IF NOT EXISTS "managementUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "managementUpdatedBy" TEXT;

CREATE INDEX IF NOT EXISTS "SignupRequest_status_createdAt_idx"
  ON "SignupRequest"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "SignupRequest_packageTier_createdAt_idx"
  ON "SignupRequest"("packageTier", "createdAt");
