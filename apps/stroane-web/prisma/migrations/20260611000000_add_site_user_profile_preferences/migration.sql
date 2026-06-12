ALTER TABLE "SiteUser"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "personalEmail" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "jobTitle" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "appearancePreference" TEXT NOT NULL DEFAULT 'system';

CREATE INDEX "SiteUser_personalEmail_idx" ON "SiteUser"("personalEmail");
