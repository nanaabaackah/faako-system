-- Canonicalize the profile address column already used by the Settings API.
-- IF NOT EXISTS preserves compatibility with deployments where the legacy
-- handler created the column at runtime.
ALTER TABLE "employeeProfile"
  ADD COLUMN IF NOT EXISTS "address" TEXT;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
