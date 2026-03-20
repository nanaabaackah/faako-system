CREATE TABLE IF NOT EXISTS "RequestThrottle" (
  "bucketKey" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "hitCount" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestThrottle_pkey" PRIMARY KEY ("bucketKey")
);

ALTER TABLE "RequestThrottle"
  ADD COLUMN IF NOT EXISTS "bucketKey" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" TEXT,
  ADD COLUMN IF NOT EXISTS "hitCount" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "windowStart" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "RequestThrottle"
SET "hitCount" = 0
WHERE "hitCount" IS NULL;

UPDATE "RequestThrottle"
SET "windowStart" = CURRENT_TIMESTAMP
WHERE "windowStart" IS NULL;

UPDATE "RequestThrottle"
SET "expiresAt" = CURRENT_TIMESTAMP
WHERE "expiresAt" IS NULL;

UPDATE "RequestThrottle"
SET "createdAt" = CURRENT_TIMESTAMP
WHERE "createdAt" IS NULL;

UPDATE "RequestThrottle"
SET "updatedAt" = CURRENT_TIMESTAMP
WHERE "updatedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "RequestThrottle_scope_expiresAt_idx" ON "RequestThrottle"("scope", "expiresAt");
CREATE INDEX IF NOT EXISTS "RequestThrottle_expiresAt_idx" ON "RequestThrottle"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RequestThrottle_hitCount_check'
  ) THEN
    ALTER TABLE "RequestThrottle"
      ADD CONSTRAINT "RequestThrottle_hitCount_check"
      CHECK ("hitCount" >= 0);
  END IF;
END
$$;
