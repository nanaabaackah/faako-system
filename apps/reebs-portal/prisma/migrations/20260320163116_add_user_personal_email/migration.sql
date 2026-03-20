ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "personalEmail" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "user_organizationId_personalEmail_key"
ON "user" ("organizationId", "personalEmail");
