-- AlterTable
ALTER TABLE "SignupRequest"
ADD COLUMN "contactName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "websiteUrl" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "brandPrimaryColor" TEXT,
ADD COLUMN "brandSecondaryColor" TEXT,
ADD COLUMN "packageTier" TEXT,
ADD COLUMN "requestedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "businessType" TEXT,
ADD COLUMN "currentWorkflow" TEXT,
ADD COLUMN "communicationChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "timelinePreference" TEXT,
ADD COLUMN "projectDetails" TEXT,
ADD COLUMN "painPoints" TEXT,
ADD COLUMN "additionalNotes" TEXT;

-- CreateIndex
CREATE INDEX "SignupRequest_packageTier_idx" ON "SignupRequest"("packageTier");
